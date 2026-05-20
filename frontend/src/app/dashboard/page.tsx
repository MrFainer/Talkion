"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const actionLabels: Record<string, string> = {
  NEWS_FALLBACK_GENERATION: "Geração de notícias",
  QUIZ_GENERATION: "Geração de quiz",
  SPEAKING_TRANSCRIPTION: "Whisper / transcrição",
  SPEAKING_EVALUATION: "Avaliação de speaking",
  WHATSAPP_MESSAGE_GENERATION: "Mensagens WhatsApp (IA)",
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatInteger = (value: unknown) =>
  new Intl.NumberFormat("pt-BR").format(Math.round(toNumber(value)));

const formatSeconds = (value: unknown) => {
  const seconds = toNumber(value);
  if (seconds <= 0) return "0s";

  if (seconds < 60) {
    const compact = seconds >= 10 ? seconds.toFixed(1) : seconds.toFixed(2);
    return `${compact.replace(/\.0$/, "").replace(/(\.\d*[1-9])0$/, "$1")}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds - minutes * 60;
  if (remainingSeconds <= 0.001) return `${minutes}min`;

  const compact = remainingSeconds >= 10
    ? remainingSeconds.toFixed(1)
    : remainingSeconds.toFixed(2);
  return `${minutes}min ${compact.replace(/\.0$/, "").replace(/(\.\d*[1-9])0$/, "$1")}s`;
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const fetchDashboard = useCallback(async () => {
    if (!isHydrated) return;
    if (!user?.id) {
      router.push("/login");
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (appliedFrom) params.append("from", appliedFrom + "T00:00:00");
      if (appliedTo) params.append("to", appliedTo + "T00:00:00");

      const res = await api.get(`/billing/teacher/${user.id}/dashboard?${params.toString()}`);
      setData(res.data);
      
      if (!appliedFrom && res.data?.period?.from) {
        setFromDate(res.data.period.from.split('T')[0]);
        setAppliedFrom(res.data.period.from.split('T')[0]);
      }
      if (!appliedTo && res.data?.period?.to) {
        setToDate(res.data.period.to.split('T')[0]);
        setAppliedTo(res.data.period.to.split('T')[0]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isHydrated, router, appliedFrom, appliedTo]);

  useEffect(() => {
    document.title = "Talkion - Dashboard";
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleFilter = () => {
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
  };

  if (loading) {
    return (
      <>
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto p-8 flex items-center justify-center">
          <p>Carregando dados de faturamento...</p>
        </main>
      </>
    );
  }

  const chartData = data?.daily?.map((d: any) => ({
    date: d.date.split("-").reverse().slice(0, 2).join("/"),
    tokens: toNumber(d.totalTokens)
  })) || [];

  const topStudentsAlphabetical = (data?.students || [])
    .slice(0, 5)
    .sort((a: any, b: any) =>
      String(a?.fullName || "").localeCompare(String(b?.fullName || ""), "pt-BR", {
        sensitivity: "base",
      }),
    );

  const actionsAlphabetical = [...(data?.actions || [])].sort((a: any, b: any) => {
    const labelA = actionLabels[a.action] || a.action;
    const labelB = actionLabels[b.action] || b.action;
    return String(labelA).localeCompare(String(labelB), "pt-BR", { sensitivity: "base" });
  });

  const whisperAction = data?.actions?.find(
    (item: any) => item.action === "SPEAKING_TRANSCRIPTION",
  );

  return (
    <>
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-auto h-9"
              />
              <span className="text-sm text-muted-foreground">até</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-auto h-9"
              />
              <Button variant="outline" size="sm" onClick={handleFilter} disabled={loading} className="h-9">
                Filtrar
              </Button>
            </div>
          </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tokens Processados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatInteger(data?.totals?.totalTokens)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tokens de Input</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatInteger(data?.totals?.totalInputTokens)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tokens de Output</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatInteger(data?.totals?.totalOutputTokens)}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tokens em Cache</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatInteger(data?.totals?.totalCachedInputTokens)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Whisper / Áudio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatSeconds(data?.totals?.totalAudioSeconds)}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Tokens Diários</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => formatInteger(value)} />
                  <Bar dataKey="tokens" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Consumo por Aluno (Top 5)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topStudentsAlphabetical.map((student: any) => (
                  <div key={student.studentId} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{student.fullName}</p>
                      <p className="text-sm text-muted-foreground">{student.events} eventos</p>
                    </div>
                    <div className="font-medium">{formatInteger(student.totalTokens)} tokens</div>
                  </div>
                ))}
                {(!data?.students || data.students.length === 0) && (
                  <p className="text-sm text-muted-foreground">Nenhum consumo registrado ainda.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Consumo por Tipo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {actionsAlphabetical.map((item: any) => (
                  <div key={item.action} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium">
                          {actionLabels[item.action] || item.action}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {item.events} evento(s)
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-md bg-muted px-3 py-2 text-sm">
                        Input: {formatInteger(item.totalInputTokens)}
                      </div>
                      <div className="rounded-md bg-muted px-3 py-2 text-sm">
                        Output: {formatInteger(item.totalOutputTokens)}
                      </div>
                      <div className="rounded-md bg-muted px-3 py-2 text-sm">
                        Total: {formatInteger(item.totalTokens)}
                      </div>
                      <div className="rounded-md bg-muted px-3 py-2 text-sm">
                        Áudio: {formatSeconds(item.totalAudioSeconds)}
                      </div>
                    </div>
                  </div>
                ))}
                {(!data?.actions || data.actions.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum consumo registrado no período.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumo OpenAI</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Input + Output</p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatInteger(data?.totals?.totalInputTokens)} input / {formatInteger(data?.totals?.totalOutputTokens)} output
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Total processado: {formatInteger(data?.totals?.totalTokens)} tokens
                  </p>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Whisper</p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatSeconds(whisperAction?.totalAudioSeconds || data?.totals?.totalAudioSeconds)}
                  </p>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Cache de Input</p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatInteger(data?.totals?.totalCachedInputTokens)} tokens
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tokens reaproveitados em chamadas com cache.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}

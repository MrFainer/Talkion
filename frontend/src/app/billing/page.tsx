"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Cpu,
  Headphones,
  GraduationCap,
  TrendingUp,
  Download,
  Zap,
  BrainCircuit,
  AudioWaveform,
  Sigma,
  UserSearch,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

const formatInteger = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(Math.round(value || 0));

const formatDecimal = (value: number, digits = 2) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value || 0);

const formatHours = (seconds: number) => {
  const hrs = (seconds || 0) / 3600;
  if (hrs < 1) return `${Math.round(seconds)}s`;
  return `${formatDecimal(hrs, 1)}h`;
};

const PIE_COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

export default function BillingPage() {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [teacherDetail, setTeacherDetail] = useState<any>(null);
  const [periodInfo, setPeriodInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    setTransitioning(true);
    const t = setTimeout(() => setTransitioning(false), 300);
    return () => clearTimeout(t);
  }, [selectedTeacherId, appliedFrom, appliedTo]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isHydrated && user && user.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [isHydrated, user, router]);

  const fetchData = useCallback(async () => {
    if (!isHydrated) return;
    if (!user?.id) {
      router.push("/login");
      return;
    }

    try {
      setLoading(true);

      if (selectedTeacherId) {
        const params = new URLSearchParams();
        if (appliedFrom) params.append("from", appliedFrom + "T00:00:00");
        if (appliedTo) params.append("to", appliedTo + "T00:00:00");
        const res = await api.get(`/billing/teacher/${selectedTeacherId}/dashboard?${params.toString()}`);
        setTeacherDetail(res.data);

        if (!appliedFrom && res.data?.period?.from) {
          setFromDate(res.data.period.from.split('T')[0]);
          setAppliedFrom(res.data.period.from.split('T')[0]);
        }
        if (!appliedTo && res.data?.period?.to) {
          setToDate(res.data.period.to.split('T')[0]);
          setAppliedTo(res.data.period.to.split('T')[0]);
        }
      } else {
        setTeacherDetail(null);
        const params = new URLSearchParams();
        if (appliedFrom) params.append("from", appliedFrom + "T00:00:00");
        if (appliedTo) params.append("to", appliedTo + "T00:00:00");

        const res = await api.get(`/admin/teachers?${params.toString()}`);
        setTeachers(res.data.data || []);
        setPeriodInfo(res.data.period);

        if (!appliedFrom && res.data?.period?.from) {
          setFromDate(res.data.period.from.split('T')[0]);
          setAppliedFrom(res.data.period.from.split('T')[0]);
        }
        if (!appliedTo && res.data?.period?.to) {
          setToDate(res.data.period.to.split('T')[0]);
          setAppliedTo(res.data.period.to.split('T')[0]);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [isHydrated, router, appliedFrom, appliedTo, selectedTeacherId]);

  useEffect(() => {
    document.title = "Talkion - Faturamento";
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilter = () => {
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
  };

  const handleExport = () => {
    if (teachers.length === 0) {
      toast.error("Não há dados para exportar.");
      return;
    }

    const data = teachers.map((t) => ({
      Professor: t.name,
      Email: t.email,
      Status: t.active ? "Ativo" : "Bloqueado",
      "Créditos": t.creditBalance || 0,
      "Tokens Input": t.inputTokens || 0,
      "Tokens Output": t.outputTokens || 0,
      "Tokens Cache": t.cachedTokens || 0,
      "Tokens Totais": t.totalTokens || 0,
      "Áudio (segundos)": t.audioSeconds || 0,
      "TTS (caracteres)": t.ttsCharacters || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Faturamento");
    XLSX.writeFile(wb, `faturamento_${appliedFrom || "inicio"}_${appliedTo || "hoje"}.xlsx`);
    toast.success("Relatório exportado!");
  };

  const totals = {
    totalTokens: teachers.reduce((s, t) => s + (t.totalTokens || 0), 0),
    inputTokens: teachers.reduce((s, t) => s + (t.inputTokens || 0), 0),
    outputTokens: teachers.reduce((s, t) => s + (t.outputTokens || 0), 0),
    cachedTokens: teachers.reduce((s, t) => s + (t.cachedTokens || 0), 0),
    audioSeconds: teachers.reduce((s, t) => s + (t.audioSeconds || 0), 0),
    ttsCharacters: teachers.reduce((s, t) => s + (t.ttsCharacters || 0), 0),
    totalCredits: teachers.reduce((s, t) => s + (t.creditBalance || 0), 0),
    activeTeachers: teachers.filter((t) => t.active).length,
  };

  const topTeachers = [...teachers]
    .sort((a, b) => (b.totalTokens || 0) - (a.totalTokens || 0))
    .slice(0, 10);

  const teacherChartData = topTeachers.map((t) => ({
    name: t.name?.split(" ")[0] || "N/A",
    tokens: t.totalTokens || 0,
    audio: t.audioSeconds || 0,
  }));

  const usageDistribution = [
    { name: "Input", value: totals.inputTokens, color: "#3b82f6" },
    { name: "Output", value: totals.outputTokens, color: "#8b5cf6" },
    { name: "Cache", value: totals.cachedTokens, color: "#10b981" },
  ].filter((d) => d.value > 0);

  const ttsData = teachers
    .filter((t) => (t.ttsCharacters || 0) > 0 || (t.audioSeconds || 0) > 0)
    .map((t) => ({
      name: t.name?.split(" ")[0] || "N/A",
      tts: t.ttsCharacters || 0,
      audio: t.audioSeconds || 0,
    }));

  if (loading) {
    return (
      <>
        <Sidebar />
        <main className="flex-1 min-w-0 p-4 pt-20 md:p-8 md:pt-8 flex items-center justify-center">
          <p className="text-muted-foreground">Carregando faturamento...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pt-20 md:p-8 md:pt-8">
        <div className={`transition-opacity duration-300 ${transitioning ? 'opacity-0' : 'opacity-100'}`}>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Faturamento</h1>
            <p className="text-muted-foreground mt-1">
              Visão geral do consumo e uso da plataforma
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="gap-2 w-full sm:w-auto justify-center"
            >
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 min-w-0">
              <div>
                <Select value={selectedTeacherId} onValueChange={(value) => value !== null && setSelectedTeacherId(value)}>
                  <SelectTrigger
                    className="h-9 w-full sm:w-44 gap-1.5"
                    aria-label="Filtrar por professor"
                  >
                    <UserSearch className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <SelectValue placeholder="Todos">
                      {teachers.find((t) => t.id === selectedTeacherId)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start" sideOffset={4} alignItemWithTrigger={false}>
                    <SelectItem value="">Todos</SelectItem>
                    {teachers.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9 w-full min-w-0 sm:w-36 focus-visible:ring-0 focus-visible:border-primary transition-colors [&::-webkit-calendar-picker-indicator]:opacity-40 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                aria-label="Data inicial"
              />
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9 w-full min-w-0 sm:w-36 focus-visible:ring-0 focus-visible:border-primary transition-colors [&::-webkit-calendar-picker-indicator]:opacity-40 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                aria-label="Data final"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleFilter}
              disabled={loading}
              className="h-9 w-full sm:w-auto"
            >
              Filtrar
            </Button>
          </div>
        </div>

        {selectedTeacherId && teacherDetail ? (
          <div className="mb-6">
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardContent className="p-4 flex items-center gap-4">
                <GraduationCap className="h-8 w-8 text-blue-500 shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Visualizando consumo de</p>
                  <p className="text-lg font-bold text-blue-700">{teacherDetail.teacher?.name}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTeacherId("")}
                  className="ml-auto text-xs"
                >
                  Ver todos
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {selectedTeacherId && teacherDetail ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tokens Processados</CardTitle>
                <Cpu className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{formatInteger(teacherDetail.totals?.totalTokens)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatInteger(teacherDetail.totals?.totalInputTokens)} input / {formatInteger(teacherDetail.totals?.totalOutputTokens)} output
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-emerald-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cache Aproveitado</CardTitle>
                <Zap className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">{formatInteger(teacherDetail.totals?.totalCachedInputTokens)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {teacherDetail.totals?.totalTokens > 0
                    ? `${formatDecimal((teacherDetail.totals?.totalCachedInputTokens / teacherDetail.totals?.totalTokens) * 100, 1)}% do total`
                    : "0% do total"}
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-violet-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Áudio Processado</CardTitle>
                <Headphones className="h-4 w-4 text-violet-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-violet-600">{formatHours(teacherDetail.totals?.totalAudioSeconds)}</div>
                <p className="text-xs text-muted-foreground mt-1">Whisper + TTS</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Alunos</CardTitle>
                <GraduationCap className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{teacherDetail.students?.length || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">{teacherDetail.totals?.events || 0} eventos de IA</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tokens Processados
                </CardTitle>
                <Cpu className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatInteger(totals.totalTokens)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatInteger(totals.inputTokens)} input / {formatInteger(totals.outputTokens)} output
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Cache Aproveitado
                </CardTitle>
                <Zap className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {formatInteger(totals.cachedTokens)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {totals.totalTokens > 0
                    ? `${formatDecimal((totals.cachedTokens / totals.totalTokens) * 100, 1)}% do total`
                    : "0% do total"}
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-violet-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Áudio Processado
                </CardTitle>
                <Headphones className="h-4 w-4 text-violet-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-violet-600">
                  {formatHours(totals.audioSeconds)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Whisper + TTS
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Professores
                </CardTitle>
                <GraduationCap className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {totals.activeTeachers}
                  <span className="text-sm text-muted-foreground font-normal ml-1">
                    / {teachers.length} ativos
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Créditos totais: {formatDecimal(totals.totalCredits)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {selectedTeacherId && teacherDetail ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Tokens Diários
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-72 w-full">
                  {(teacherDetail.daily || []).length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={teacherDetail.daily.map((d: any) => ({ date: d.date?.split("-").reverse().slice(0, 2).join("/"), tokens: d.totalTokens }))}>
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(value: any) => [formatInteger(value), "Tokens"]} />
                        <Bar dataKey="tokens" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Nenhum dado diário.</div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Sigma className="h-4 w-4 text-primary" />
                    Consumo por Tipo de Ação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(teacherDetail.actions || []).length > 0 ? (
                    <div className="space-y-3 max-h-[260px] overflow-y-auto">
                      {(teacherDetail.actions || []).sort((a: any, b: any) => b.totalTokens - a.totalTokens).map((item: any) => (
                        <div key={item.action} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {({ NEWS_FALLBACK_GENERATION: "Geração notícias", NEWS_TTS_GENERATION: "TTS Áudio", QUIZ_GENERATION: "Geração quiz", SPEAKING_TRANSCRIPTION: "Whisper transcrição", SPEAKING_EVALUATION: "Avaliação speaking", WHATSAPP_MESSAGE_GENERATION: "Mensagens WhatsApp" } as Record<string, string>)[item.action] || item.action}
                            </p>
                            <p className="text-xs text-muted-foreground">{item.events} evento(s)</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold">{formatInteger(item.totalTokens)}</p>
                            <p className="text-xs text-muted-foreground">tokens</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma ação registrada.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    Consumo por Aluno (Top 5)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(teacherDetail.students || []).length > 0 ? (
                    <div className="space-y-3">
                      {(teacherDetail.students || []).sort((a: any, b: any) => b.totalTokens - a.totalTokens).slice(0, 5).map((student: any) => (
                        <div key={student.studentId} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{student.fullName}</p>
                            <p className="text-xs text-muted-foreground">{student.events} eventos</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold">{formatInteger(student.totalTokens)}</p>
                            <p className="text-xs text-muted-foreground">tokens</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhum aluno com consumo.</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4 text-primary" />
                    Resumo OpenAI
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Input + Output</p>
                      <p className="text-lg font-semibold mt-1">
                        {formatInteger(teacherDetail.totals?.totalInputTokens)} input / {formatInteger(teacherDetail.totals?.totalOutputTokens)} output
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Total: {formatInteger(teacherDetail.totals?.totalTokens)} tokens</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Whisper / Áudio</p>
                      <p className="text-lg font-semibold mt-1">{formatHours(teacherDetail.totals?.totalAudioSeconds)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Cache de Input</p>
                      <p className="text-lg font-semibold mt-1">{formatInteger(teacherDetail.totals?.totalCachedInputTokens)} tokens</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Top Professores por Consumo
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-72 w-full">
                  {teacherChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={teacherChartData}
                        layout="vertical"
                        margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                      >
                        <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          width={80}
                        />
                        <Tooltip
                          formatter={(value: any) => [formatInteger(value), "Tokens"]}
                        />
                        <Bar dataKey="tokens" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                      Nenhum consumo registrado no período.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4 text-primary" />
                    Distribuição de Uso
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-72 w-full">
                  {usageDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={usageDistribution}
                          cx="50%"
                          cy="45%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {usageDistribution.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          formatter={(value: string) => (
                            <span className="text-xs text-muted-foreground">{value}</span>
                          )}
                        />
                        <Tooltip
                          formatter={(value: any) => [formatInteger(value), "Tokens"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                      Nenhum dado disponível.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Sigma className="h-4 w-4 text-primary" />
                    Consumo Individual por Professor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topTeachers.length > 0 ? (
                    <div className="space-y-3">
                      {topTeachers.map((teacher, idx) => (
                        <div
                          key={teacher.id}
                          className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-medium text-muted-foreground w-5 shrink-0">
                              {idx + 1}º
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {teacher.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {teacher.active ? "Ativo" : "Bloqueado"}
                                {teacher.creditBalance > 0 &&
                                  ` · ${formatDecimal(teacher.creditBalance)} créditos`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold">
                              {formatInteger(teacher.totalTokens)}
                            </p>
                            <p className="text-xs text-muted-foreground">tokens</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Nenhum professor com consumo registrado.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <AudioWaveform className="h-4 w-4 text-primary" />
                    Áudio e TTS por Professor
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-72 w-full">
                  {ttsData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={ttsData}
                        layout="vertical"
                        margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                      >
                        <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          width={80}
                        />
                        <Tooltip
                          formatter={(value: any, name: any) => [
                            name === "tts" ? formatInteger(value) + " chars" : formatHours(value),
                            name === "tts" ? "TTS" : "Áudio",
                          ]}
                        />
                        <Bar dataKey="audio" name="audio" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                      Nenhum áudio processado no período.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        <div className="text-center text-xs text-muted-foreground py-4 border-t">
          <p>
            Período:{" "}
            {periodInfo?.from
              ? new Date(periodInfo.from).toLocaleDateString("pt-BR")
              : "início"}{" "}
            a{" "}
            {periodInfo?.to
              ? new Date(periodInfo.to).toLocaleDateString("pt-BR")
              : "hoje"}
          </p>
        </div>
        </div>
      </main>
    </>
  );
}

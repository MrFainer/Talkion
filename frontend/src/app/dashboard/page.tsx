"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  CreditCard,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  TrendingUp,
  CalendarDays,
  ArrowUp,
  ArrowDown,
  Trophy,
  Mic,
  Zap,
} from "lucide-react";

const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(value);

const formatWeekLabel = (dateStr: string) => {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isHydrated && user?.role === 'ADMIN') {
      router.push('/billing');
    }
  }, [isHydrated, user, router]);

  const fetchDashboard = useCallback(async () => {
    if (!isHydrated) return;
    if (!user?.id) {
      router.push("/login");
      return;
    }

    try {
      setLoading(true);
      const res = await api.get(`/teacher-dashboard/${user.id}`);
      setData(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isHydrated, router]);

  useEffect(() => {
    document.title = "Talkion - Dashboard";
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <>
        <Sidebar />
        <main className="flex-1 min-w-0 p-4 pt-20 md:p-8 md:pt-8 flex items-center justify-center">
          <p className="text-muted-foreground">Carregando dashboard...</p>
        </main>
      </>
    );
  }

  const summary = data?.summary || {};
  const engagement = data?.engagement || {};
  const ranking = data?.ranking || {};
  const pronunciation = data?.pronunciationEvolution || {};

  const chartData = (pronunciation.weekly || []).map((w: any) => ({
    label: formatWeekLabel(w.period),
    score: w.averageScore,
  }));

  const dailyChartData = (engagement.last7Days || []).map((d: any) => ({
    label: new Date(d.date + "T00:00:00").toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "numeric",
    }),
    rate: d.rate,
  }));

  const rateChange = engagement.dailyRateChange ?? 0;

  return (
    <>
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pt-20 md:p-8 md:pt-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe o desempenho e engajamento dos seus alunos
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Créditos Disponíveis
              </CardTitle>
              <CreditCard className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {formatNumber(summary.creditBalance ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Saldo disponível para uso
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Correções Realizadas
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatNumber(summary.totalCorrecoes ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Feedbacks de pronúncia enviados
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-violet-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avaliações Realizadas
              </CardTitle>
              <ClipboardCheck className="h-4 w-4 text-violet-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-violet-600">
                {formatNumber(summary.totalAvaliacoes ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Quizzes respondidos pelos alunos
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Exercícios Gerados
              </CardTitle>
              <FileText className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {formatNumber(summary.totalExerciciosGerados ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total de quizzes criados
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Taxa de Resposta Diária
                </CardTitle>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                    rateChange >= 0
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {rateChange >= 0 ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : (
                    <ArrowDown className="h-3 w-3" />
                  )}
                  {rateChange >= 0 ? "+" : ""}
                  {rateChange}%
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-bold">
                  {engagement.dailyResponseRate ?? 0}%
                </span>
                <span className="text-sm text-muted-foreground">
                  de {engagement.totalActiveStudents ?? 0} alunos ativos
                </span>
              </div>
              <div className="text-sm text-muted-foreground mb-3">
                <span className="font-medium text-foreground">
                  {engagement.todayActiveStudents ?? 0}
                </span>{" "}
                alunos responderam hoje
                <span className="mx-2">·</span>
                <span className="font-medium text-foreground">
                  {engagement.yesterdayRate ?? 0}%
                </span>{" "}
                ontem
              </div>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height={128}>
                  <BarChart data={dailyChartData}>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, 100]}
                      unit="%"
                    />
                    <Tooltip
                      formatter={(value: any) => [`${value}%`, "Taxa"]}
                    />
                    <Bar
                      dataKey="rate"
                      fill="hsl(var(--primary))"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                Dias Consecutivos Praticando
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-bold">
                  {engagement.consecutiveDays?.classAverage ?? 0}
                </span>
                <span className="text-sm text-muted-foreground">
                  dias de média da turma
                </span>
              </div>

              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Melhores Sequências
              </h4>
              <div className="space-y-2">
                {(engagement.consecutiveDays?.bestStreaks || []).map(
                  (student: any, idx: number) => (
                    <div
                      key={student.studentId}
                      className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-medium text-muted-foreground w-5">
                          {idx + 1}º
                        </span>
                        <span className="text-sm font-medium truncate">
                          {student.fullName}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-primary">
                        {student.streak} dias
                      </span>
                    </div>
                  ),
                )}
                {(!engagement.consecutiveDays?.bestStreaks ||
                  engagement.consecutiveDays.bestStreaks.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum dado disponível ainda.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Card className="md:col-span-2 lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Ranking Semanal de Engajamento
              </CardTitle>
              {ranking.weekStart && (
                <p className="text-xs text-muted-foreground mt-1">
                  Semana de{" "}
                  {new Date(
                    ranking.weekStart + "T00:00:00"
                  ).toLocaleDateString("pt-BR")}{" "}
                  a{" "}
                  {new Date(
                    ranking.weekEnd + "T00:00:00"
                  ).toLocaleDateString("pt-BR")}
                </p>
              )}
            </CardHeader>
            <CardContent>
              {(ranking.ranking || []).length > 0 ? (
                <div className="space-y-2">
                  {(ranking.ranking || []).map((student: any, idx: number) => (
                    <div
                      key={student.studentId}
                      className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
                        idx === 0
                          ? "bg-amber-50 border border-amber-200"
                          : idx === 1
                          ? "bg-gray-50 border border-gray-200"
                          : idx === 2
                          ? "bg-orange-50 border border-orange-200"
                          : "bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            idx === 0
                              ? "bg-amber-400 text-white"
                              : idx === 1
                              ? "bg-gray-400 text-white"
                              : idx === 2
                              ? "bg-orange-400 text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {student.fullName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {student.quizAnswers} quiz
                            {student.quizAnswers !== 1 ? "zes" : ""} ·{" "}
                            {student.speakingFeedbacks} pronúncia
                            {student.speakingFeedbacks !== 1 ? "s" : ""} ·{" "}
                            {student.lessonConfirmations} aula
                            {student.lessonConfirmations !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Zap className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-bold">
                          {student.score}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Trophy className="h-10 w-10 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum dado de engajamento nesta semana.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2 lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Mic className="h-4 w-4 text-primary" />
                Evolução de Pronúncia
              </CardTitle>
              {pronunciation.total > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Média geral:{" "}
                  <span className="font-medium text-foreground">
                    {pronunciation.average}
                  </span>{" "}
                  ·{" "}
                  {formatNumber(pronunciation.total)} avaliação
                  {pronunciation.total !== 1 ? "ões" : ""} no total
                </p>
              )}
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height={256}>
                      <LineChart data={chartData}>
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          domain={[0, 10]}
                          tick={{ fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(value: any) => [
                            `${Number(value).toFixed(1)}`,
                            "Nota média",
                          ]}
                          labelFormatter={(label: any) => `Semana: ${label}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ r: 3, fill: "hsl(var(--primary))" }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-center gap-6 mt-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                      <span>Nota média semanal</span>
                    </div>
                    <span>
                      Máx:{" "}
                      {Math.max(
                        ...chartData.map((d: any) => d.score)
                      ).toFixed(1)}
                    </span>
                    <span>
                      Mín:{" "}
                      {Math.min(
                        ...chartData.map((d: any) => d.score)
                      ).toFixed(1)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Mic className="h-10 w-10 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {chartData.length === 1
                      ? "Apenas uma avaliação registrada. Continue acompanhando para ver a evolução."
                      : "Nenhuma avaliação de pronúncia registrada ainda."}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    As avaliações aparecerão conforme os alunos enviarem áudios.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-xs text-muted-foreground py-4 border-t">
          <p>
            Última atualização:{" "}
            {new Date().toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        </div>
      </main>
    </>
  );
}

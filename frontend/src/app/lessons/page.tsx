"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { useAuthStore } from "@/store/auth";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type LessonAgendaItem = {
  lessonId: string;
  studentId: string;
  studentName: string;
  whatsappNumber: string;
  kind: "RECURRING" | "EXTRA";
  time: string;
  date: string;
  status: "PENDING" | "CONFIRMED" | "DECLINED";
  confirmationId: string | null;
};

type AgendaResponse = {
  date: string;
  items: LessonAgendaItem[];
};

type StatusFilter = "ALL" | LessonAgendaItem["status"];

const statusLabel: Record<LessonAgendaItem["status"], string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmada",
  DECLINED: "Recusada",
};

const statusClass: Record<LessonAgendaItem["status"], string> = {
  PENDING: "bg-amber-100 text-amber-900",
  CONFIRMED: "bg-emerald-100 text-emerald-900",
  DECLINED: "bg-rose-100 text-rose-900",
};

const filterLabel: Record<StatusFilter, string> = {
  ALL: "Total",
  CONFIRMED: "Confirmadas",
  PENDING: "Pendentes",
  DECLINED: "Recusadas",
};

export default function LessonsPage() {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [loading, setLoading] = useState(false);
  const [agenda, setAgenda] = useState<AgendaResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const selectedDateLabel = useMemo(() => {
    const date = new Date(`${selectedDate}T00:00:00`);
    return Number.isNaN(date.getTime()) ? selectedDate : date.toLocaleDateString("pt-BR");
  }, [selectedDate]);

  const stats = useMemo(() => {
    const items = agenda?.items || [];
    const out = { total: items.length, pending: 0, confirmed: 0, declined: 0 };
    for (const item of items) {
      if (item.status === "CONFIRMED") out.confirmed += 1;
      else if (item.status === "DECLINED") out.declined += 1;
      else out.pending += 1;
    }
    return out;
  }, [agenda]);

  const filteredItems = useMemo(() => {
    const items = agenda?.items || [];
    if (statusFilter === "ALL") return items;
    return items.filter((item) => item.status === statusFilter);
  }, [agenda, statusFilter]);

  useEffect(() => {
    document.title = "Talkion - Aulas";
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!user?.id) router.push("/login");
  }, [isHydrated, user?.id]);

  const fetchAgenda = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/lessons/teacher/${user.id}/agenda`, {
        params: { date: selectedDate },
      });
      setAgenda(res.data as AgendaResponse);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao carregar aulas.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedDate]);

  useEffect(() => {
    if (!isHydrated || !user?.id) return;
    void fetchAgenda();
  }, [isHydrated, user?.id, fetchAgenda]);

  useEffect(() => {
    setStatusFilter("ALL");
  }, [selectedDate]);

  const toggleFilter = (next: StatusFilter) => {
    setStatusFilter((current) => (current === next ? "ALL" : next));
  };

  const filterCardClass = (key: StatusFilter) =>
    `transition-all duration-200 cursor-pointer select-none ${
      statusFilter === key ? "ring-2 ring-primary shadow-sm" : "hover:bg-muted/20 hover:shadow-sm"
    }`;

  return (
    <div className="flex min-h-[100dvh] w-full">
      <Sidebar />
      <main className="flex-1 bg-muted/40 p-4 pt-20 md:p-8 md:pt-8 overflow-x-hidden">
        <div className="mx-auto w-full space-y-6 max-w-none">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Aulas</h1>
              <p className="text-sm text-muted-foreground">
                Agenda do dia ({selectedDateLabel}) com status de confirmação pelo WhatsApp.
              </p>
              {statusFilter !== "ALL" ? (
                <p className="text-xs text-muted-foreground">
                  Filtro ativo: {filterLabel[statusFilter]}
                </p>
              ) : null}
            </div>
            <div className="flex items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="lessons-date">Dia</Label>
                <Input
                  id="lessons-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  disabled={loading}
                  className="h-9 w-full min-w-0 sm:w-44"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className={filterCardClass("ALL")} onClick={() => toggleFilter("ALL")}>
              <CardHeader className="py-4">
                <CardTitle className="text-sm text-muted-foreground">Total</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="text-2xl font-semibold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card className={filterCardClass("CONFIRMED")} onClick={() => toggleFilter("CONFIRMED")}>
              <CardHeader className="py-4">
                <CardTitle className="text-sm text-muted-foreground">Confirmadas</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="text-2xl font-semibold text-emerald-700">{stats.confirmed}</div>
              </CardContent>
            </Card>
            <Card className={filterCardClass("PENDING")} onClick={() => toggleFilter("PENDING")}>
              <CardHeader className="py-4">
                <CardTitle className="text-sm text-muted-foreground">Pendentes</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="text-2xl font-semibold text-amber-700">{stats.pending}</div>
              </CardContent>
            </Card>
            <Card className={filterCardClass("DECLINED")} onClick={() => toggleFilter("DECLINED")}>
              <CardHeader className="py-4">
                <CardTitle className="text-sm text-muted-foreground">Recusadas</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="text-2xl font-semibold text-rose-700">{stats.declined}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="w-full">
            <CardHeader className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-base">Agenda</CardTitle>
              <p className="text-sm text-muted-foreground">
                {loading
                  ? "Carregando..."
                  : filteredItems.length === 0
                    ? "Nenhuma aula."
                    : `${filteredItems.length} aula(s)`}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : agenda && agenda.items.length === 0 ? (
                <div className="rounded-lg border bg-muted/20 p-6">
                  <p className="text-sm text-muted-foreground">Nenhuma aula para este dia.</p>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="rounded-lg border bg-muted/20 p-6">
                  <p className="text-sm text-muted-foreground">Nenhuma aula para este filtro.</p>
                </div>
              ) : (
                <div
                  key={statusFilter}
                  className="animate-in fade-in duration-200"
                >
                  <div className="space-y-2 md:hidden">
                    {filteredItems.map((item) => (
                      <div key={`${item.lessonId}-${item.time}`} className="rounded-lg border bg-background p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium">{item.time}</div>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusClass[item.status]}`}
                          >
                            {statusLabel[item.status]}
                          </span>
                        </div>
                        <div className="mt-2 text-sm">{item.studentName}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item.kind === "EXTRA" ? "Extra" : "Recorrente"}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden md:block overflow-x-auto">
                    <Table className="w-full min-w-[900px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">Horário</TableHead>
                          <TableHead>Aluno</TableHead>
                          <TableHead className="w-[160px]">Status</TableHead>
                          <TableHead className="w-[140px]">Tipo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredItems.map((item) => (
                          <TableRow key={`${item.lessonId}-${item.time}`}>
                            <TableCell className="font-medium">{item.time}</TableCell>
                            <TableCell className="break-words">{item.studentName}</TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusClass[item.status]}`}
                              >
                                {statusLabel[item.status]}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {item.kind === "EXTRA" ? "Extra" : "Recorrente"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

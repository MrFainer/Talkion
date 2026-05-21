"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldCheck, Ban, CheckCircle2, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import * as XLSX from "xlsx";

export default function AdminPage() {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const fetchTeachers = useCallback(async () => {
    if (!isHydrated) return;
    if (!user?.id || user.role !== 'ADMIN') {
      router.push("/dashboard");
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (appliedFrom) params.append("from", appliedFrom + "T00:00:00");
      if (appliedTo) params.append("to", appliedTo + "T00:00:00");

      const res = await api.get(`/admin/teachers?${params.toString()}`);
      setTeachers(res.data.data);

      if (!appliedFrom && res.data?.period?.from) {
        setFromDate(res.data.period.from.split('T')[0]);
        setAppliedFrom(res.data.period.from.split('T')[0]);
      }
      if (!appliedTo && res.data?.period?.to) {
        setToDate(res.data.period.to.split('T')[0]);
        setAppliedTo(res.data.period.to.split('T')[0]);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao carregar professores");
    } finally {
      setLoading(false);
    }
  }, [isHydrated, user, router, appliedFrom, appliedTo]);

  useEffect(() => {
    document.title = "Talkion - Administração";
  }, []);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  const handleFilter = () => {
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
  };

  const handleExportExcel = () => {
    if (teachers.length === 0) {
      toast.error("Não há dados para exportar.");
      return;
    }

    const dataToExport = teachers.map((t) => ({
      Nome: t.name,
      Email: t.email,
      "Data de Cadastro": formatDate(t.created_at),
      Status: t.active ? "Ativo" : "Bloqueado",
      "Tokens Totais": t.totalTokens || 0,
      "Tokens Input": t.inputTokens || 0,
      "Tokens Output": t.outputTokens || 0,
      "Tokens Cache": t.cachedTokens || 0,
      "Whisper (Segundos)": t.audioSeconds || 0,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Professores");

    let fileName = "relatorio_professores.xlsx";
    if (appliedFrom || appliedTo) {
      const fromStr = appliedFrom || "inicio";
      const toStr = appliedTo || "hoje";
      fileName = `relatorio_professores_${fromStr}_ate_${toStr}.xlsx`;
    }

    XLSX.writeFile(workbook, fileName);
    toast.success("Relatório exportado com sucesso!");
  };

  const toggleStatus = async (teacherId: string) => {
    setToggling(teacherId);
    try {
      await api.patch(`/admin/teachers/${teacherId}/toggle`);
      toast.success("Status atualizado com sucesso!");
      await fetchTeachers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao atualizar status");
    } finally {
      setToggling(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(dateString));
  };

  if (!isHydrated || loading) {
    return (
      <>
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-4 pt-20 md:p-8 md:pt-8 flex items-center justify-center">
          <p>Carregando administração...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-4 pt-20 md:p-8 md:pt-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Administração</h1>
            <p className="text-muted-foreground mt-1">Gerencie os professores da plataforma</p>
          </div>
          <div className="grid w-full gap-3 sm:w-auto sm:flex sm:items-center">
            <Button onClick={handleExportExcel} variant="outline" className="gap-2 w-full sm:w-auto justify-center">
              <Download className="w-4 h-4" />
              Exportar Excel
            </Button>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_auto_auto] sm:items-center">
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full sm:w-36"
                aria-label="De"
              />
              <span className="hidden text-muted-foreground sm:inline">até</span>
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground sm:hidden">Até</span>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full sm:w-36"
                  aria-label="Até"
                />
              </div>
            </div>
            <Button onClick={handleFilter} variant="secondary" className="w-full sm:w-auto">
              Filtrar
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Professores Cadastrados</CardTitle>
            <CardDescription>
              Visualize o status de acesso e o custo total estimado de cada professor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {teachers.length === 0 ? (
              <p className="text-muted-foreground">Nenhum professor encontrado.</p>
            ) : (
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead>Tokens Totais</TableHead>
                    <TableHead>Input</TableHead>
                    <TableHead>Output</TableHead>
                    <TableHead>Cache</TableHead>
                    <TableHead>Whisper (s)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.map((teacher) => (
                    <TableRow key={teacher.id}>
                      <TableCell className="font-medium">{teacher.name}</TableCell>
                      <TableCell className="max-w-[240px] whitespace-normal break-words">{teacher.email}</TableCell>
                      <TableCell>{formatDate(teacher.created_at)}</TableCell>
                      <TableCell>{teacher.totalTokens?.toLocaleString("pt-BR") || 0}</TableCell>
                      <TableCell>{teacher.inputTokens?.toLocaleString("pt-BR") || 0}</TableCell>
                      <TableCell>{teacher.outputTokens?.toLocaleString("pt-BR") || 0}</TableCell>
                      <TableCell>{teacher.cachedTokens?.toLocaleString("pt-BR") || 0}</TableCell>
                      <TableCell>{teacher.audioSeconds?.toLocaleString("pt-BR") || 0}</TableCell>
                      <TableCell>
                        {teacher.active ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                            <Ban className="h-3.5 w-3.5" />
                            Bloqueado
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant={teacher.active ? "destructive" : "default"}
                          size="sm"
                          onClick={() => toggleStatus(teacher.id)}
                          disabled={toggling === teacher.id}
                        >
                          {toggling === teacher.id ? "Aguarde..." : teacher.active ? "Bloquear Acesso" : "Liberar Acesso"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}

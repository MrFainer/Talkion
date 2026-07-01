"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldCheck, Ban, CheckCircle2, Download, Coins, Settings2, Power, PowerOff, ChevronDown, ChevronRight, CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";

export default function AdminPage() {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [creditValues, setCreditValues] = useState<Record<string, string>>({});
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [creditDialogTeacher, setCreditDialogTeacher] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [expandedTeacherId, setExpandedTeacherId] = useState<string | null>(null);
  const [teacherSettings, setTeacherSettings] = useState<Record<string, any>>({});
  const [settingsLoading, setSettingsLoading] = useState<Record<string, boolean>>({});

  const [plans, setPlans] = useState<any[]>([]);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planDialogTeacherId, setPlanDialogTeacherId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);

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
    api.get("/subscriptions/plans").then((res) => setPlans(res.data || [])).catch(() => {});
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
      "TTS (Caracteres)": t.ttsCharacters || 0,
      "Créditos": t.creditBalance || 0,
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

  const handleSaveCredits = async (teacherId: string) => {
    const value = parseFloat(creditValues[teacherId]);
    if (isNaN(value) || value < 0) {
      toast.error("Valor inválido para créditos.");
      return;
    }
    try {
      await api.patch(`/admin/teachers/${teacherId}/credits`, { amount: value, mode: "set" });
      toast.success("Créditos atualizados com sucesso!");
      setCreditDialogOpen(false);
      setCreditDialogTeacher(null);
      await fetchTeachers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao atualizar créditos");
    }
  };

  const CREDIT_ACTION_COPY: Record<string, { name: string; description: string }> = {
    news_capture_level_1: { name: "Captura de notícia Nível 1", description: "" },
    news_capture_level_2: { name: "Captura de notícia Nível 2", description: "" },
    news_capture_level_3: { name: "Captura de notícia Nível 3", description: "" },
    news_ai_fallback: { name: "Notícia gerada por IA (fallback)", description: "" },
    news_tts: { name: "Áudio TTS da notícia", description: "" },
    quiz_generation: { name: "Quiz gerado para um nível", description: "" },
    quick_tip_generation: { name: "Geração de Quick Tip", description: "" },
    news_quiz_group_send: { name: "Envio da notícia + quiz para grupo", description: "" },
    quiz_response_received: { name: "Receber resposta do quiz", description: "" },
    quiz_response_metrics: { name: "Salvar métricas da resposta", description: "" },
    news_individual_send: { name: "Envio individual de notícia", description: "" },
    speaking_transcription: { name: "Transcrição de áudio", description: "" },
    speaking_feedback: { name: "Feedback da IA", description: "" },
    lesson_confirmation_send: { name: "Envio de confirmação de aula", description: "" },
    lesson_confirmation_process: { name: "Interpretação da resposta pela IA", description: "" },
    weekly_summary_send: { name: "Envio de resumo semanal", description: "" },
    weekly_summary_process: { name: "Processamento de resposta do resumo semanal", description: "" },
    content_generation: { name: "Geração de conteúdo educacional", description: "" },
    birthday_send: { name: "Envio de mensagem de aniversário", description: "" },
    admin_adjustment: { name: "Ajuste manual (admin)", description: "" },
    admin_plan_change: { name: "Troca de plano", description: "" },
  };

  const openCreditDialog = async (teacher: any) => {
    setCreditDialogTeacher(teacher);
    setCreditValues((prev) => ({ ...prev, [teacher.id]: String(teacher.creditBalance ?? 0) }));
    setEditMode(false);
    setCreditDialogOpen(true);
    setTransactionsLoading(true);
    try {
      const res = await api.get(`/credits/transactions/${teacher.id}`);
      setTransactions(res.data?.data || []);
    } catch {
      setTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const handleChangePlan = async () => {
    if (!planDialogTeacherId || !selectedPlanId) return;
    setSavingPlan(true);
    try {
      await api.patch(`/admin/teachers/${planDialogTeacherId}/plan`, { planId: selectedPlanId });
      toast.success("Plano alterado com sucesso!");
      setPlanDialogOpen(false);
      await fetchTeachers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao alterar plano");
    } finally {
      setSavingPlan(false);
    }
  };

  const toggleExpandTeacher = useCallback(async (teacherId: string) => {
    if (expandedTeacherId === teacherId) {
      setExpandedTeacherId(null);
      return;
    }
    setExpandedTeacherId(teacherId);
    if (!teacherSettings[teacherId]) {
      setSettingsLoading((prev) => ({ ...prev, [teacherId]: true }));
      try {
        const res = await api.get(`/message-settings/${teacherId}`);
        setTeacherSettings((prev) => ({ ...prev, [teacherId]: res.data }));
      } catch {
        toast.error("Erro ao carregar configurações do professor.");
      } finally {
        setSettingsLoading((prev) => ({ ...prev, [teacherId]: false }));
      }
    }
  }, [expandedTeacherId, teacherSettings]);

  const handleAdminToggleSetting = async (teacherId: string, field: string, currentValue: boolean) => {
    const nextValue = !currentValue;
    setTeacherSettings((prev) => ({
      ...prev,
      [teacherId]: { ...prev[teacherId], [field]: nextValue },
    }));
    try {
      await api.put(`/message-settings/${teacherId}`, { [field]: nextValue });
    } catch {
      setTeacherSettings((prev) => ({
        ...prev,
        [teacherId]: { ...prev[teacherId], [field]: currentValue },
      }));
      toast.error("Erro ao atualizar configuração.");
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
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <Button onClick={() => router.push("/admin/credit-config")} variant="outline" className="gap-2 w-full sm:w-auto justify-center">
              <Settings2 className="w-4 h-4" />
              Créditos
            </Button>
            <Button onClick={handleExportExcel} variant="outline" className="gap-2 w-full sm:w-auto justify-center">
              <Download className="w-4 h-4" />
              Exportar Excel
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 min-w-0 overflow-hidden">
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9 w-full min-w-0 sm:w-40"
                aria-label="De"
              />
              <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">até</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9 w-full min-w-0 sm:w-40"
                aria-label="Até"
              />
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
                    <TableHead>Plano</TableHead>
                    <TableHead>Tokens Totais</TableHead>
                    <TableHead>Input</TableHead>
                    <TableHead>Output</TableHead>
                    <TableHead>Cache</TableHead>
                    <TableHead>Whisper (s)</TableHead>
                    <TableHead>TTS (carac.)</TableHead>
                    <TableHead>Créditos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.map((teacher) => (
                    <React.Fragment key={teacher.id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => toggleExpandTeacher(teacher.id)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {expandedTeacherId === teacher.id ? (
                              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            {teacher.name}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[240px] whitespace-normal break-words">{teacher.email}</TableCell>
                        <TableCell>{formatDate(teacher.created_at)}</TableCell>
                        <TableCell>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlanDialogTeacherId(teacher.id);
                              setSelectedPlanId(teacher.subscription?.planId || "");
                              setPlanDialogOpen(true);
                            }}
                            className="inline-flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            {teacher.subscription?.planName || "Sem plano"}
                          </button>
                        </TableCell>
                        <TableCell>{teacher.totalTokens?.toLocaleString("pt-BR") || 0}</TableCell>
                        <TableCell>{teacher.inputTokens?.toLocaleString("pt-BR") || 0}</TableCell>
                        <TableCell>{teacher.outputTokens?.toLocaleString("pt-BR") || 0}</TableCell>
                        <TableCell>{teacher.cachedTokens?.toLocaleString("pt-BR") || 0}</TableCell>
                        <TableCell>{teacher.audioSeconds?.toLocaleString("pt-BR") || 0}</TableCell>
                        <TableCell>{teacher.ttsCharacters?.toLocaleString("pt-BR") || 0}</TableCell>
                        <TableCell>
                            <button
                              onClick={() => openCreditDialog(teacher)}
                              className="inline-flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors"
                            >
                              <Coins className="h-3.5 w-3.5" />
                              {Number(teacher.creditBalance ?? 0).toLocaleString("pt-BR", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </button>
                        </TableCell>
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
                      {expandedTeacherId === teacher.id && (
                        <TableRow>
                          <TableCell colSpan={13} className="bg-muted/30 p-4">
                            {settingsLoading[teacher.id] ? (
                              <p className="text-sm text-muted-foreground">Carregando configurações...</p>
                            ) : teacherSettings[teacher.id] ? (
                              <div className="flex flex-wrap items-center gap-6">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground whitespace-nowrap">Capturar notícia</span>
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            handleAdminToggleSetting(teacher.id, 'admin_news_capture_enabled', teacherSettings[teacher.id]?.admin_news_capture_enabled !== false);
                                          }}
                                          className={teacherSettings[teacher.id]?.admin_news_capture_enabled !== false ? "text-red-500" : "text-green-500"}
                                        >
                                          {teacherSettings[teacher.id]?.admin_news_capture_enabled !== false ? (
                                            <PowerOff className="h-4 w-4" />
                                          ) : (
                                            <Power className="h-4 w-4" />
                                          )}
                                        </Button>
                                      }
                                    />
                                    <TooltipContent>
                                      <p>{teacherSettings[teacher.id]?.admin_news_capture_enabled !== false ? "Desativar Captura" : "Ativar Captura"}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground whitespace-nowrap">Gerar quiz</span>
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            handleAdminToggleSetting(teacher.id, 'admin_quiz_generation_enabled', teacherSettings[teacher.id]?.admin_quiz_generation_enabled !== false);
                                          }}
                                          className={teacherSettings[teacher.id]?.admin_quiz_generation_enabled !== false ? "text-red-500" : "text-green-500"}
                                        >
                                          {teacherSettings[teacher.id]?.admin_quiz_generation_enabled !== false ? (
                                            <PowerOff className="h-4 w-4" />
                                          ) : (
                                            <Power className="h-4 w-4" />
                                          )}
                                        </Button>
                                      }
                                    />
                                    <TooltipContent>
                                      <p>{teacherSettings[teacher.id]?.admin_quiz_generation_enabled !== false ? "Desativar Quiz" : "Ativar Quiz"}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground whitespace-nowrap">Envio privado</span>
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            handleAdminToggleSetting(teacher.id, 'admin_auto_send_enabled', teacherSettings[teacher.id]?.admin_auto_send_enabled !== false);
                                          }}
                                          className={teacherSettings[teacher.id]?.admin_auto_send_enabled !== false ? "text-red-500" : "text-green-500"}
                                        >
                                          {teacherSettings[teacher.id]?.admin_auto_send_enabled !== false ? (
                                            <PowerOff className="h-4 w-4" />
                                          ) : (
                                            <Power className="h-4 w-4" />
                                          )}
                                        </Button>
                                      }
                                    />
                                    <TooltipContent>
                                      <p>{teacherSettings[teacher.id]?.admin_auto_send_enabled !== false ? "Desativar Envio" : "Ativar Envio"}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground whitespace-nowrap">Envio grupo</span>
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            handleAdminToggleSetting(teacher.id, 'admin_group_send_enabled', teacherSettings[teacher.id]?.admin_group_send_enabled !== false);
                                          }}
                                          className={teacherSettings[teacher.id]?.admin_group_send_enabled !== false ? "text-red-500" : "text-green-500"}
                                        >
                                          {teacherSettings[teacher.id]?.admin_group_send_enabled !== false ? (
                                            <PowerOff className="h-4 w-4" />
                                          ) : (
                                            <Power className="h-4 w-4" />
                                          )}
                                        </Button>
                                      }
                                    />
                                    <TooltipContent>
                                      <p>{teacherSettings[teacher.id]?.admin_group_send_enabled !== false ? "Desativar Envio Grupo" : "Ativar Envio Grupo"}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground whitespace-nowrap">Conf. Aula</span>
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            handleAdminToggleSetting(teacher.id, 'admin_lessons_confirmation_enabled', teacherSettings[teacher.id]?.admin_lessons_confirmation_enabled !== false);
                                          }}
                                          className={teacherSettings[teacher.id]?.admin_lessons_confirmation_enabled !== false ? "text-red-500" : "text-green-500"}
                                        >
                                          {teacherSettings[teacher.id]?.admin_lessons_confirmation_enabled !== false ? (
                                            <PowerOff className="h-4 w-4" />
                                          ) : (
                                            <Power className="h-4 w-4" />
                                          )}
                                        </Button>
                                      }
                                    />
                                    <TooltipContent>
                                      <p>{teacherSettings[teacher.id]?.admin_lessons_confirmation_enabled !== false ? "Desativar Conf. Aula" : "Ativar Conf. Aula"}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground whitespace-nowrap">Conteúdo</span>
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            handleAdminToggleSetting(teacher.id, 'admin_content_generation_enabled', teacherSettings[teacher.id]?.admin_content_generation_enabled !== false);
                                          }}
                                          className={teacherSettings[teacher.id]?.admin_content_generation_enabled !== false ? "text-red-500" : "text-green-500"}
                                        >
                                          {teacherSettings[teacher.id]?.admin_content_generation_enabled !== false ? (
                                            <PowerOff className="h-4 w-4" />
                                          ) : (
                                            <Power className="h-4 w-4" />
                                          )}
                                        </Button>
                                      }
                                    />
                                    <TooltipContent>
                                      <p>{teacherSettings[teacher.id]?.admin_content_generation_enabled !== false ? "Desativar Conteúdo" : "Ativar Conteúdo"}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground whitespace-nowrap">Res. Semanal</span>
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            handleAdminToggleSetting(teacher.id, 'admin_weekly_summary_enabled', teacherSettings[teacher.id]?.admin_weekly_summary_enabled !== false);
                                          }}
                                          className={teacherSettings[teacher.id]?.admin_weekly_summary_enabled !== false ? "text-red-500" : "text-green-500"}
                                        >
                                          {teacherSettings[teacher.id]?.admin_weekly_summary_enabled !== false ? (
                                            <PowerOff className="h-4 w-4" />
                                          ) : (
                                            <Power className="h-4 w-4" />
                                          )}
                                        </Button>
                                      }
                                    />
                                    <TooltipContent>
                                      <p>{teacherSettings[teacher.id]?.admin_weekly_summary_enabled !== false ? "Desativar Res. Semanal" : "Ativar Res. Semanal"}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground whitespace-nowrap">Aniversário</span>
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon-sm"
                                          onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            handleAdminToggleSetting(teacher.id, 'admin_birthday_enabled', teacherSettings[teacher.id]?.admin_birthday_enabled !== false);
                                          }}
                                          className={teacherSettings[teacher.id]?.admin_birthday_enabled !== false ? "text-red-500" : "text-green-500"}
                                        >
                                          {teacherSettings[teacher.id]?.admin_birthday_enabled !== false ? (
                                            <PowerOff className="h-4 w-4" />
                                          ) : (
                                            <Power className="h-4 w-4" />
                                          )}
                                        </Button>
                                      }
                                    />
                                    <TooltipContent>
                                      <p>{teacherSettings[teacher.id]?.admin_birthday_enabled !== false ? "Desativar Aniversário" : "Ativar Aniversário"}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">Erro ao carregar configurações.</p>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Plano</DialogTitle>
            <DialogDescription>
              Selecione o novo plano para este professor. Os créditos serão redefinidos para o valor do plano escolhido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="plan-select">Plano</Label>
              <Select value={selectedPlanId} onValueChange={(val) => setSelectedPlanId(val || "")}>
                <SelectTrigger id="plan-select" className="w-full">
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} — R$ {plan.price?.toFixed(2)} / {plan.credits?.toLocaleString("pt-BR")} créditos
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleChangePlan} disabled={savingPlan || !selectedPlanId}>
              {savingPlan ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={creditDialogOpen} onOpenChange={(open) => { setCreditDialogOpen(open); if (!open) setCreditDialogTeacher(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {creditDialogTeacher?.name || "Professor"} — Créditos
            </DialogTitle>
            <DialogDescription>
              Saldo atual: <strong>{Number(creditDialogTeacher?.creditBalance ?? 0).toLocaleString("pt-BR")}</strong> créditos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <Button variant={editMode ? "default" : "outline"} size="sm" onClick={() => setEditMode(true)}>
                Ajustar saldo
              </Button>
              <Button variant={!editMode ? "default" : "outline"} size="sm" onClick={() => setEditMode(false)}>
                Histórico
              </Button>
            </div>

            {editMode ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Defina um novo saldo de créditos para este professor.</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={creditValues[creditDialogTeacher?.id] ?? creditDialogTeacher?.creditBalance ?? 0}
                    onChange={(e) =>
                      setCreditValues((prev) => ({
                        ...prev,
                        [creditDialogTeacher?.id]: e.target.value,
                      }))
                    }
                    className="w-40"
                  />
                  <Button onClick={() => handleSaveCredits(creditDialogTeacher?.id)}>
                    Salvar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Últimas transações de crédito deste professor.</p>
                {transactionsLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma transação encontrada.</p>
                ) : (
                  <div className="max-h-80 overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-2 font-medium">Data</th>
                          <th className="text-left p-2 font-medium">Ação</th>
                          <th className="text-right p-2 font-medium">Valor</th>
                          <th className="text-right p-2 font-medium">Saldo após</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx: any) => {
                          const copy = CREDIT_ACTION_COPY[tx.action_key];
                          return (
                            <tr key={tx.id} className="border-t">
                              <td className="p-2 text-muted-foreground whitespace-nowrap">
                                {new Date(tx.created_at).toLocaleDateString("pt-BR")}
                              </td>
                              <td className="p-2">
                                {copy?.name || tx.action_key || tx.description || tx.reference_type || "—"}
                              </td>
                              <td className={`p-2 text-right font-medium ${tx.type === "CREDIT" ? "text-green-600" : "text-red-600"}`}>
                                {tx.type === "CREDIT" ? "+" : "-"}{tx.amount}
                              </td>
                              <td className="p-2 text-right text-muted-foreground">
                                {tx.balance_after?.toLocaleString("pt-BR")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreditDialogOpen(false); setCreditDialogTeacher(null); }}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

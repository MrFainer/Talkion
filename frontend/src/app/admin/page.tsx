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
import { ShieldCheck, Ban, CheckCircle2, Download, Coins, Settings2, Power, PowerOff, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import * as XLSX from "xlsx";

export default function AdminPage() {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [editingCredits, setEditingCredits] = useState<string | null>(null);
  const [creditValues, setCreditValues] = useState<Record<string, string>>({});

  const [expandedTeacherId, setExpandedTeacherId] = useState<string | null>(null);
  const [teacherSettings, setTeacherSettings] = useState<Record<string, any>>({});
  const [settingsLoading, setSettingsLoading] = useState<Record<string, boolean>>({});

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
      await api.patch(`/admin/teachers/${teacherId}/credits`, { credit_balance: value });
      toast.success("Créditos atualizados com sucesso!");
      setEditingCredits(null);
      await fetchTeachers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao atualizar créditos");
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
                        <TableCell>{teacher.totalTokens?.toLocaleString("pt-BR") || 0}</TableCell>
                        <TableCell>{teacher.inputTokens?.toLocaleString("pt-BR") || 0}</TableCell>
                        <TableCell>{teacher.outputTokens?.toLocaleString("pt-BR") || 0}</TableCell>
                        <TableCell>{teacher.cachedTokens?.toLocaleString("pt-BR") || 0}</TableCell>
                        <TableCell>{teacher.audioSeconds?.toLocaleString("pt-BR") || 0}</TableCell>
                        <TableCell>{teacher.ttsCharacters?.toLocaleString("pt-BR") || 0}</TableCell>
                        <TableCell>
                          {editingCredits === teacher.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                value={creditValues[teacher.id] ?? teacher.creditBalance ?? 0}
                                onChange={(e) =>
                                  setCreditValues((prev) => ({
                                    ...prev,
                                    [teacher.id]: e.target.value,
                                  }))
                                }
                                className="h-8 w-20 text-xs"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-xs"
                                onClick={() => handleSaveCredits(teacher.id)}
                              >
                                OK
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-xs"
                                onClick={() => setEditingCredits(null)}
                              >
                                X
                              </Button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingCredits(teacher.id);
                                setCreditValues((prev) => ({
                                  ...prev,
                                  [teacher.id]: String(teacher.creditBalance ?? 0),
                                }));
                              }}
                              className="inline-flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors"
                            >
                              <Coins className="h-3.5 w-3.5" />
                              {Number(teacher.creditBalance ?? 0).toLocaleString("pt-BR", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                            </button>
                          )}
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
                          <TableCell colSpan={12} className="bg-muted/30 p-4">
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
    </>
  );
}

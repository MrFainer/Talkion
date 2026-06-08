"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { useAuthStore } from "@/store/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, X, Power, PowerOff, AlertTriangle } from "lucide-react";

type DailyRunResponse = {
  message?: string;
  news?: {
    created?: number;
    skippedSameDay?: number;
    skippedSameNews?: number;
    errors?: number;
    items?: any[];
  };
  quizzes?: {
    created?: number;
    existing?: number;
    errors?: number;
    items?: any[];
  };
};

type WhatsappGroupOption = {
  id: string;
  subject: string;
};

type WhatsappGroupSyncStatus = {
  stage: string;
  progress: number;
  message: string;
  inProgress: boolean;
  ready: boolean;
  stale: boolean;
  groupsCount: number;
  lastError: string | null;
};

type MessageSettingsPayload = {
  news_capture_time?: string;
  private_news_send_time?: string;
  group_news_send_time?: string;
  lessons_confirmation_time?: string;
  lessons_confirmation_enabled?: boolean;
  weekly_summary_time?: string;
  weekly_summary_enabled?: boolean;
  admin_weekly_summary_enabled?: boolean;
  news_capture_enabled?: boolean;
  quiz_generation_enabled?: boolean;
  auto_send_enabled?: boolean;
  group_send_enabled?: boolean;
  admin_news_capture_enabled?: boolean;
  admin_quiz_generation_enabled?: boolean;
  admin_auto_send_enabled?: boolean;
  admin_group_send_enabled?: boolean;
  admin_lessons_confirmation_enabled?: boolean;
  automation_days?: number[];
  auto_group_targets?: any;
};

export default function AutomationPage() {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();

  const [dailyRunDialogOpen, setDailyRunDialogOpen] = useState(false);
  const [runningDailyNews, setRunningDailyNews] = useState(false);
  const [dailyRunProgress, setDailyRunProgress] = useState(0);
  const [dailyRunResult, setDailyRunResult] = useState<DailyRunResponse | null>(null);
  const [dailyRunError, setDailyRunError] = useState<string | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState(0);
  const [sendPrivateNews, setSendPrivateNews] = useState(false);
  const [sendGroupNews, setSendGroupNews] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedGroupLevel, setSelectedGroupLevel] = useState("LEVEL_1");
  const [availableGroups, setAvailableGroups] = useState<WhatsappGroupOption[]>([]);
  const [groupOptionsLoading, setGroupOptionsLoading] = useState(false);
  const [groupSyncStatus, setGroupSyncStatus] = useState<WhatsappGroupSyncStatus | null>(null);
  const [groupConnectionReady, setGroupConnectionReady] = useState<boolean | null>(null);

  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [newsCaptureTime, setNewsCaptureTime] = useState("08:00");
  const [privateSendTime, setPrivateSendTime] = useState("08:00");
  const [groupSendTime, setGroupSendTime] = useState("08:00");
  const [lessonsConfirmationTime, setLessonsConfirmationTime] = useState("08:00");
  const [lessonsConfirmationEnabled, setLessonsConfirmationEnabled] = useState(true);
  const [weeklySummaryTime, setWeeklySummaryTime] = useState("08:00");
  const [weeklySummaryEnabled, setWeeklySummaryEnabled] = useState(true);
  const [weeklySummarySaving, setWeeklySummarySaving] = useState(false);
  const [initialWeeklySummaryEnabled, setInitialWeeklySummaryEnabled] = useState(true);
  const [newsCaptureEnabled, setNewsCaptureEnabled] = useState(true);
  const [quizGenerationEnabled, setQuizGenerationEnabled] = useState(true);
  const [autoSendEnabled, setAutoSendEnabled] = useState(true);
  const [groupSendEnabled, setGroupSendEnabled] = useState(true);
  const [initialNewsCaptureEnabled, setInitialNewsCaptureEnabled] = useState(true);
  const [initialAutoSendEnabled, setInitialAutoSendEnabled] = useState(true);
  const [initialGroupSendEnabled, setInitialGroupSendEnabled] = useState(true);
  const [initialLessonsConfirmationEnabled, setInitialLessonsConfirmationEnabled] = useState(true);
  const [automationDays, setAutomationDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [lessonsConfirmationSaving, setLessonsConfirmationSaving] = useState(false);
  const [sendingWeeklySummary, setSendingWeeklySummary] = useState(false);
  const [sendingLessonConfirmations, setSendingLessonConfirmations] = useState(false);
  const [autoGroupTargets, setAutoGroupTargets] = useState<
    Array<{ groupId: string; groupLevel: "LEVEL_1" | "LEVEL_2" | "LEVEL_3" }>
  >([]);
  const [groupSearch, setGroupSearch] = useState("");

  useEffect(() => {
    document.title = "Talkion - Automação";
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!user?.id) {
      router.push("/login");
    }
  }, [isHydrated, user?.id]);

  const stopProgressTimer = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const handleDailyRunDialogChange = useCallback(
    (open: boolean) => {
      if (runningDailyNews) return;
      setDailyRunDialogOpen(open);
      if (!open) {
        setDailyRunResult(null);
        setDailyRunError(null);
        setDailyRunProgress(0);
      }
    },
    [runningDailyNews],
  );

  const handleRunDailyNews = async () => {
    if (!user?.id) return;

    setDailyRunDialogOpen(true);
    setRunningDailyNews(true);
    setDailyRunResult(null);
    setDailyRunError(null);
    setDailyRunProgress(12);
    stopProgressTimer();
    progressIntervalRef.current = setInterval(() => {
      setDailyRunProgress((current) => (current >= 88 ? current : current + 8));
    }, 350);
    const toastId = toast.loading("Gerando notícia e quiz do dia...");

    try {
      const res = await api.post("/news/daily-run", { teacherId: user.id });
      const payload = res.data as DailyRunResponse;
      const summary = [
        payload?.news?.created ? `${payload.news.created} notícia(s) criada(s)` : null,
        payload?.news?.skippedSameDay ? `${payload.news.skippedSameDay} bloqueio(s) por dia` : null,
        payload?.news?.skippedSameNews ? `${payload.news.skippedSameNews} bloqueio(s) por mesma notícia` : null,
        payload?.quizzes?.created ? `${payload.quizzes.created} quiz(es) criado(s)` : null,
        payload?.quizzes?.existing ? `${payload.quizzes.existing} quiz(es) já existente(s)` : null,
      ].filter(Boolean);

      stopProgressTimer();
      setDailyRunProgress(100);
      setDailyRunResult(payload);
      toast.success(summary.length ? summary.join(" | ") : "Processamento concluído com sucesso.", {
        id: toastId,
      });
    } catch (error: any) {
      stopProgressTimer();
      setDailyRunProgress(100);
      setDailyRunError(error.response?.data?.message || "Erro ao gerar notícia e quiz.");
      toast.error(error.response?.data?.message || "Erro ao gerar notícia e quiz.", { id: toastId });
    } finally {
      setRunningDailyNews(false);
    }
  };

  const resetDispatchModal = useCallback(() => {
    setSendPrivateNews(false);
    setSendGroupNews(false);
    setSelectedGroupId("");
    setSelectedGroupLevel("LEVEL_1");
    setGroupSyncStatus(null);
    setGroupConnectionReady(null);
    setDispatching(false);
    setDispatchProgress(0);
  }, []);

  const fetchStoredGroups = useCallback(async () => {
    if (!user?.id) return;

    setGroupOptionsLoading(true);
    try {
      const res = await api.get(`/whatsapp/groups/cached/${user.id}`);
      setAvailableGroups(res.data.groups || []);
      setGroupSyncStatus(res.data.sync || null);
      const connectedFromGroups = res.data.connected === true ? true : res.data.connected === false ? false : null;
      if (connectedFromGroups === false) {
        try {
          const statusRes = await api.get(`/whatsapp/status/${user.id}`);
          const raw = String(statusRes.data?.status || "").trim().toLowerCase();
          const normalized = ["open", "connected", "online"].includes(raw) ? "open" : raw;
          setGroupConnectionReady(normalized === "open");
        } catch {
          setGroupConnectionReady(false);
        }
      } else {
        setGroupConnectionReady(connectedFromGroups);
      }
    } catch (error: any) {
      setAvailableGroups([]);
      setGroupSyncStatus(null);
      setGroupConnectionReady(null);
      toast.error(error.response?.data?.message || "Erro ao carregar grupos sincronizados.");
    } finally {
      setGroupOptionsLoading(false);
    }
  }, [user?.id]);

  const handleDispatchDialogChange = useCallback(
    (open: boolean) => {
      if (dispatching) return;

      if (open) {
        resetDispatchModal();
        setDispatchDialogOpen(true);
        void fetchStoredGroups();
        return;
      }

      setDispatchDialogOpen(false);
      resetDispatchModal();
    },
    [dispatching, fetchStoredGroups, resetDispatchModal],
  );

  const handleDispatch = async () => {
    if (!user?.id) return;
    if (!sendPrivateNews && !sendGroupNews) {
      toast.error("Selecione pelo menos um destino para o disparo.");
      return;
    }

    setDispatching(true);
    setDispatchProgress(10);

    const progressInterval = setInterval(() => {
      setDispatchProgress((prev) => (prev < 80 ? prev + 10 : prev));
    }, 800);

    try {
      if (sendGroupNews && !selectedGroupId) {
        throw new Error("GROUP_REQUIRED");
      }

      const statusRes = await api.get(`/whatsapp/status/${user.id}`);
      if (statusRes.data?.status !== "open") {
        throw new Error("WHATSAPP_NOT_CONNECTED");
      }

      const res = await api.post("/whatsapp/dispatch-news", {
        teacherId: user.id,
        sendPrivate: sendPrivateNews,
        sendGroup: sendGroupNews,
        groupId: sendGroupNews ? selectedGroupId : undefined,
        groupLevel: sendGroupNews ? selectedGroupLevel : undefined,
      });

      clearInterval(progressInterval);
      setDispatchProgress(100);
      toast.success(
        res.data?.jobId ? `Disparo iniciado (jobId: ${res.data.jobId}).` : "Disparo iniciado com sucesso.",
      );
      setDispatchDialogOpen(false);
      resetDispatchModal();
    } catch (error: any) {
      clearInterval(progressInterval);

      if (error.message === "WHATSAPP_NOT_CONNECTED") {
        toast.error("O WhatsApp não está conectado. Acesse a tela 'WhatsApp' e escaneie o QR Code.");
      } else if (error.message === "GROUP_REQUIRED") {
        toast.error("Selecione um grupo sincronizado para enviar no grupo.");
      } else {
        toast.error(error.response?.data?.message || "Erro ao iniciar disparo.");
      }

      setDispatching(false);
      setDispatchProgress(0);
    }
  };

  const fetchSchedule = useCallback(async () => {
    if (!user?.id) return;
    setScheduleLoading(true);
    try {
      const res = await api.get(`/message-settings/${user.id}`);
      const payload = (res.data || {}) as MessageSettingsPayload;
      setNewsCaptureTime(payload.news_capture_time || "08:00");
      setPrivateSendTime(payload.private_news_send_time || "08:00");
      setGroupSendTime(payload.group_news_send_time || "08:00");
      setLessonsConfirmationTime(payload.lessons_confirmation_time || "08:00");
      setLessonsConfirmationEnabled(payload.lessons_confirmation_enabled !== false);
      setWeeklySummaryTime(payload.weekly_summary_time || "08:00");
      setWeeklySummaryEnabled(payload.weekly_summary_enabled === true);
      setInitialWeeklySummaryEnabled(payload.admin_weekly_summary_enabled !== false);
      setNewsCaptureEnabled(payload.news_capture_enabled !== false);
      setInitialNewsCaptureEnabled(payload.admin_news_capture_enabled !== false);
      setQuizGenerationEnabled(payload.quiz_generation_enabled !== false);
      setAutoSendEnabled(payload.auto_send_enabled !== false);
      setInitialAutoSendEnabled(payload.admin_auto_send_enabled !== false);
      setGroupSendEnabled(payload.group_send_enabled !== false);
      setInitialGroupSendEnabled(payload.admin_group_send_enabled !== false);
      setLessonsConfirmationEnabled(payload.lessons_confirmation_enabled !== false);
      setInitialLessonsConfirmationEnabled(payload.admin_lessons_confirmation_enabled !== false);
      setAutomationDays(Array.isArray(payload.automation_days) ? payload.automation_days : [0, 1, 2, 3, 4, 5, 6]);
      const rawTargets = payload.auto_group_targets;
      const parsedTargets = Array.isArray(rawTargets)
        ? rawTargets
            .map((item: any) => {
              const groupId = String(item?.groupId || item?.id || "").trim();
              const groupLevelRaw = String(item?.groupLevel || "LEVEL_1").trim();
              const groupLevel =
                groupLevelRaw === "LEVEL_2"
                  ? "LEVEL_2"
                  : groupLevelRaw === "LEVEL_3"
                    ? "LEVEL_3"
                    : "LEVEL_1";
              if (!groupId) return null;
              return { groupId, groupLevel };
            })
            .filter(Boolean)
        : [];
      setAutoGroupTargets(parsedTargets as any);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao carregar horários.");
    } finally {
      setScheduleLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isHydrated || !user?.id) return;
    void fetchSchedule();
  }, [isHydrated, user?.id, fetchSchedule]);

  useEffect(() => {
    if (!isHydrated || !user?.id) return;
    void fetchStoredGroups();
  }, [isHydrated, user?.id, fetchStoredGroups]);

  const handleSaveSchedule = async () => {
    if (!user?.id) return;
    setScheduleSaving(true);
    const toastId = toast.loading("Salvando horários...");
    try {
      await api.put(`/message-settings/${user.id}`, {
        news_capture_time: newsCaptureTime || "08:00",
        private_news_send_time: privateSendTime || "08:00",
        group_news_send_time: groupSendTime || "08:00",
        lessons_confirmation_time: lessonsConfirmationTime || "08:00",
        lessons_confirmation_enabled: lessonsConfirmationEnabled,
        weekly_summary_time: weeklySummaryTime || "08:00",
        weekly_summary_enabled: weeklySummaryEnabled,
        news_capture_enabled: newsCaptureEnabled,
        quiz_generation_enabled: quizGenerationEnabled,
        auto_send_enabled: autoSendEnabled,
        group_send_enabled: groupSendEnabled,
        automation_days: automationDays,
        auto_group_targets: autoGroupTargets,
      });
      toast.success("Horários salvos com sucesso.", { id: toastId });
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao salvar horários.", { id: toastId });
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleToggleLessonsConfirmationEnabled = async () => {
    if (!user?.id) return;
    if (scheduleLoading || scheduleSaving || lessonsConfirmationSaving) return;

    const nextValue = !lessonsConfirmationEnabled;
    const previousValue = lessonsConfirmationEnabled;

    setLessonsConfirmationEnabled(nextValue);
    setLessonsConfirmationSaving(true);

    try {
      await api.put(`/message-settings/${user.id}`, {
        lessons_confirmation_enabled: nextValue,
      });
      if (nextValue) {
        toast.success("Função de Envio de Confirmação de Aula Ativada.");
      } else {
        toast("Função de Envio de Confirmação de Aula Desativada.", {
          icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
        });
      }
    } catch (error: any) {
      setLessonsConfirmationEnabled(previousValue);
      toast.error(error.response?.data?.message || "Erro ao atualizar confirmação de aula.");
    } finally {
      setLessonsConfirmationSaving(false);
    }
  };

  const handleToggleWeeklySummary = async () => {
    if (!user?.id) return;
    if (scheduleLoading || scheduleSaving || weeklySummarySaving) return;

    const nextValue = !weeklySummaryEnabled;
    const previousValue = weeklySummaryEnabled;

    setWeeklySummaryEnabled(nextValue);
    setWeeklySummarySaving(true);

    try {
      await api.put(`/message-settings/${user.id}`, {
        weekly_summary_enabled: nextValue,
      });
      if (nextValue) {
        toast.success("Função de Resumo Semanal Ativada.");
      } else {
        toast("Função de Resumo Semanal Desativada.", {
          icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
        });
      }
    } catch (error: any) {
      setWeeklySummaryEnabled(previousValue);
      toast.error(error.response?.data?.message || "Erro ao atualizar resumo semanal.");
    } finally {
      setWeeklySummarySaving(false);
    }
  };

  const handleSendWeeklySummary = async () => {
    if (!user?.id) return;
    setSendingWeeklySummary(true);
    const toastId = toast.loading("Enviando resumo semanal...");
    try {
      const res = await api.post("/whatsapp/send-weekly-summary", { teacherId: user.id });
      toast.success(
        res.data?.sent ? `${res.data.sent} resumo(s) enviado(s)` : "Resumo semanal enviado com sucesso.",
        { id: toastId },
      );
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao enviar resumo semanal.", { id: toastId });
    } finally {
      setSendingWeeklySummary(false);
    }
  };

  const handleSendLessonConfirmations = async () => {
    if (!user?.id) return;
    setSendingLessonConfirmations(true);
    const toastId = toast.loading("Enviando confirmações de aula...");
    try {
      const res = await api.post("/whatsapp/send-lesson-confirmations", { teacherId: user.id });
      toast.success(
        res.data?.sent ? `${res.data.sent} confirmação(ões) enviada(s)` : "Confirmações enviadas com sucesso.",
        { id: toastId },
      );
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao enviar confirmações de aula.", { id: toastId });
    } finally {
      setSendingLessonConfirmations(false);
    }
  };

  const handleToggleNewsCapture = async () => {
    if (!user?.id) return;
    const nextValue = !newsCaptureEnabled;
    setNewsCaptureEnabled(nextValue);
    try {
      await api.put(`/message-settings/${user.id}`, { news_capture_enabled: nextValue });
    } catch {
      setNewsCaptureEnabled(!nextValue);
      toast.error("Erro ao atualizar captura de notícia.");
    }
  };

  const handleToggleAutoSend = async () => {
    if (!user?.id) return;
    const nextValue = !autoSendEnabled;
    setAutoSendEnabled(nextValue);
    try {
      await api.put(`/message-settings/${user.id}`, { auto_send_enabled: nextValue });
    } catch {
      setAutoSendEnabled(!nextValue);
      toast.error("Erro ao atualizar envio automático.");
    }
  };

  const toggleAutomationDay = (day: number) => {
    setAutomationDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length <= 1) return prev;
        return prev.filter((d) => d !== day);
      }
      return [...prev, day].sort();
    });
  };

  const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const isGroupSelected = (groupId: string) => {
    return autoGroupTargets.some((item) => item.groupId === groupId);
  };

  const addAutoGroupTarget = (groupId: string) => {
    setAutoGroupTargets((current) => {
      if (current.some((item) => item.groupId === groupId)) return current;
      return [...current, { groupId, groupLevel: "LEVEL_1" }];
    });
  };

  const removeAutoGroupTarget = (groupId: string) => {
    setAutoGroupTargets((current) => current.filter((item) => item.groupId !== groupId));
  };

  const setGroupLevelForTarget = (groupId: string, level: "LEVEL_1" | "LEVEL_2" | "LEVEL_3") => {
    setAutoGroupTargets((current) =>
      current.map((item) => (item.groupId === groupId ? { ...item, groupLevel: level } : item)),
    );
  };

  const normalizedQuery = groupSearch.trim().toLowerCase();
  const availableGroupsFiltered = normalizedQuery
    ? availableGroups.filter((group) => String(group.subject || "").toLowerCase().includes(normalizedQuery))
    : availableGroups;

  const hasAutoGroupsSelected = autoGroupTargets.length > 0;

  return (
    <>
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-4 pt-20 md:p-8 md:pt-8 space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold">Automação</h1>
        </div>

        {initialNewsCaptureEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Gerar Notícia e Quiz</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Busca a notícia do dia e valida/cria os quizzes de cada nível.</p>
            <Button onClick={handleRunDailyNews} disabled={runningDailyNews} className="h-9 shrink-0">
              {runningDailyNews ? "Processando..." : "Gerar"}
            </Button>
          </CardContent>
        </Card>
        )}

        {initialNewsCaptureEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Disparar Notícia</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Inicia o envio no privado, no grupo, ou nos dois (processa em segundo plano).
            </p>
            <Button onClick={() => handleDispatchDialogChange(true)} className="h-9">
              Disparar
            </Button>
          </CardContent>
        </Card>
        )}

        {initialWeeklySummaryEnabled && weeklySummaryEnabled && new Date().getDay() === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo Semanal Manual</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Envia manualmente o resumo semanal de aulas para os alunos (disponível apenas às segundas-feiras).
            </p>
            <Button onClick={handleSendWeeklySummary} disabled={sendingWeeklySummary} className="h-9 shrink-0">
              {sendingWeeklySummary ? "Enviando..." : "Enviar Resumo Semanal"}
            </Button>
          </CardContent>
        </Card>
        )}

        {initialLessonsConfirmationEnabled && lessonsConfirmationEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Confirmações de Aula Manual</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Envia manualmente as confirmações de aula de hoje para os alunos.
            </p>
            <Button onClick={handleSendLessonConfirmations} disabled={sendingLessonConfirmations} className="h-9 shrink-0">
              {sendingLessonConfirmations ? "Enviando..." : "Enviar Confirmações"}
            </Button>
          </CardContent>
        </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Automação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure os horários de captura e envios automáticos.
            </p>

            <div className="flex flex-wrap gap-x-4 gap-y-2 items-end">
              {initialNewsCaptureEnabled && (
              <div className="flex items-center gap-1.5">
                <Label htmlFor="news-capture-time" className="text-xs whitespace-nowrap">Capturar</Label>
                <Input
                  id="news-capture-time"
                  type="time"
                  value={newsCaptureTime}
                  onChange={(e) => setNewsCaptureTime(e.target.value)}
                  disabled={scheduleLoading || scheduleSaving}
                  className="h-8 w-28"
                />
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={handleToggleNewsCapture}
                        className={newsCaptureEnabled ? "text-red-500" : "text-green-500"}
                        aria-label={newsCaptureEnabled ? "Desativar captura de notícia" : "Ativar captura de notícia"}
                      >
                        {newsCaptureEnabled ? (
                          <PowerOff className="h-3.5 w-3.5" />
                        ) : (
                          <Power className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    }
                  />
                  <TooltipContent>
                    <p>{newsCaptureEnabled ? "Desativar Captura" : "Ativar Captura"}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              )}
              {initialAutoSendEnabled && (
              <div className="flex items-center gap-1.5">
                <Label htmlFor="private-send-time" className="text-xs whitespace-nowrap">Privado</Label>
                <Input
                  id="private-send-time"
                  type="time"
                  value={privateSendTime}
                  onChange={(e) => setPrivateSendTime(e.target.value)}
                  disabled={scheduleLoading || scheduleSaving}
                  className="h-8 w-28"
                />
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={handleToggleAutoSend}
                        className={autoSendEnabled ? "text-red-500" : "text-green-500"}
                        aria-label={autoSendEnabled ? "Desativar envio automático" : "Ativar envio automático"}
                      >
                        {autoSendEnabled ? (
                          <PowerOff className="h-3.5 w-3.5" />
                        ) : (
                          <Power className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    }
                  />
                  <TooltipContent>
                    <p>{autoSendEnabled ? "Desativar Envio" : "Ativar Envio"}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              )}
              {initialGroupSendEnabled && (
              <div className="flex items-center gap-1.5">
                <Label htmlFor="group-send-time" className="text-xs whitespace-nowrap">Grupos</Label>
                <Input
                  id="group-send-time"
                  type="time"
                  value={groupSendTime}
                  onChange={(e) => setGroupSendTime(e.target.value)}
                  disabled={scheduleLoading || scheduleSaving || !hasAutoGroupsSelected}
                  className="h-8 w-28"
                />
              </div>
              )}
              {initialLessonsConfirmationEnabled && (
              <div className="flex items-center gap-1.5">
                <Label htmlFor="lessons-confirm-time" className="text-xs whitespace-nowrap">Conf. Aula</Label>
                <Input
                  id="lessons-confirm-time"
                  type="time"
                  value={lessonsConfirmationTime}
                  onChange={(e) => setLessonsConfirmationTime(e.target.value)}
                  disabled={scheduleLoading || scheduleSaving}
                  className="h-8 w-28"
                />
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={handleToggleLessonsConfirmationEnabled}
                        disabled={scheduleLoading || scheduleSaving || lessonsConfirmationSaving}
                        className={lessonsConfirmationEnabled ? "text-red-500" : "text-green-500"}
                        aria-label={lessonsConfirmationEnabled ? "Desativar confirmação de aula" : "Ativar confirmação de aula"}
                      >
                        {lessonsConfirmationEnabled ? (
                          <PowerOff className="h-3.5 w-3.5" />
                        ) : (
                          <Power className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    }
                  />
                  <TooltipContent>
                    <p>{lessonsConfirmationEnabled ? "Desativar Conf." : "Ativar Conf."}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              )}
              {initialWeeklySummaryEnabled && (
              <div className="flex items-center gap-1.5">
                <Label htmlFor="weekly-summary-time" className="text-xs whitespace-nowrap">Res. Semanal (seg)</Label>
                <Input
                  id="weekly-summary-time"
                  type="time"
                  value={weeklySummaryTime}
                  onChange={(e) => setWeeklySummaryTime(e.target.value)}
                  disabled={scheduleLoading || scheduleSaving}
                  className="h-8 w-28"
                />
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={handleToggleWeeklySummary}
                        disabled={scheduleLoading || scheduleSaving || weeklySummarySaving}
                        className={weeklySummaryEnabled ? "text-red-500" : "text-green-500"}
                        aria-label={weeklySummaryEnabled ? "Desativar resumo semanal" : "Ativar resumo semanal"}
                      >
                        {weeklySummaryEnabled ? (
                          <PowerOff className="h-3.5 w-3.5" />
                        ) : (
                          <Power className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    }
                  />
                  <TooltipContent>
                    <p>{weeklySummaryEnabled ? "Desativar Res." : "Ativar Res."}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              )}
            </div>

            {!initialNewsCaptureEnabled && !initialAutoSendEnabled && !initialGroupSendEnabled && !initialLessonsConfirmationEnabled && !initialWeeklySummaryEnabled && user?.role !== "ADMIN" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                As funções de automação estão desativadas para a sua conta. Entre em contato com o administrador do
                Talkion para mais informações.
              </div>
            )}

            {(initialNewsCaptureEnabled || initialAutoSendEnabled || initialGroupSendEnabled || initialLessonsConfirmationEnabled || user?.role === "ADMIN") && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Dias da semana (automático)</Label>
              <div className="flex flex-wrap gap-2">
                {dayLabels.map((label, index) => (
                  <Button
                    key={index}
                    type="button"
                    variant={automationDays.includes(index) ? "default" : "outline"}
                    onClick={() => toggleAutomationDay(index)}
                    disabled={scheduleLoading || scheduleSaving}
                    size="sm"
                    className="h-9 min-w-[44px]"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            )}

            {(initialNewsCaptureEnabled || initialAutoSendEnabled || initialGroupSendEnabled || initialLessonsConfirmationEnabled || user?.role === "ADMIN") && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Grupos do envio automático</p>
                  <p className="text-xs text-muted-foreground">
                    Selecione quais grupos recebem a notícia automaticamente no horário configurado.
                  </p>
                </div>
              </div>

              {groupConnectionReady === false ? (
                <Alert variant="destructive">
                  <AlertTitle>WhatsApp desconectado</AlertTitle>
                  <AlertDescription>Conecte o WhatsApp para sincronizar os grupos e liberar a seleção.</AlertDescription>
                </Alert>
              ) : null}

              {groupConnectionReady && !groupOptionsLoading && availableGroups.length === 0 ? (
                <Alert>
                  <AlertTitle>Nenhum grupo capturado</AlertTitle>
                  <AlertDescription>
                    {groupSyncStatus?.inProgress
                      ? "A sincronização está em andamento. Aguarde alguns instantes."
                      : "Seus grupos não foram encontrados no banco. Vá para a tela de WhatsApp e sincronize novamente."}
                  </AlertDescription>
                </Alert>
              ) : null}

              {groupConnectionReady !== false && availableGroups.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="group-search">Lista de grupos</Label>
                      <Input
                        id="group-search"
                        placeholder="Buscar grupo..."
                        value={groupSearch}
                        onChange={(e) => setGroupSearch(e.target.value)}
                        disabled={scheduleLoading || scheduleSaving || groupOptionsLoading}
                      />
                    </div>

                    <div className="rounded-md border max-h-[50vh] overflow-y-auto overscroll-contain md:max-h-80">
                      {availableGroupsFiltered.length === 0 ? (
                        <p className="p-4 text-sm text-muted-foreground">Nenhum grupo encontrado para este filtro.</p>
                      ) : (
                        <div className="divide-y">
                          {availableGroupsFiltered.map((group) => {
                            const selected = isGroupSelected(group.id);
                            return (
                              <div key={group.id} className="grid grid-cols-[1fr_auto] items-center gap-3 p-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{group.subject}</p>
                                </div>
                                <Button
                                  type="button"
                                  variant={selected ? "outline" : "default"}
                                  onClick={() => addAutoGroupTarget(group.id)}
                                  disabled={selected || scheduleLoading || scheduleSaving || groupOptionsLoading}
                                  size="sm"
                                  className="shrink-0"
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Adicionar
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Selecionados ({autoGroupTargets.length})</p>
                        <p className="text-xs text-muted-foreground">Esses grupos receberão automaticamente.</p>
                      </div>
                      {autoGroupTargets.length > 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setAutoGroupTargets([])}
                          disabled={scheduleLoading || scheduleSaving}
                          size="sm"
                          className="shrink-0"
                        >
                          Limpar
                        </Button>
                      ) : null}
                    </div>

                    {!hasAutoGroupsSelected ? (
                      <Alert>
                        <AlertTitle>Nenhum grupo selecionado</AlertTitle>
                        <AlertDescription>
                          Selecione pelo menos 1 grupo para habilitar o envio automático em grupos.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="rounded-md border max-h-[40vh] overflow-y-auto overscroll-contain md:max-h-80">
                        <div className="divide-y">
                          {autoGroupTargets.map((target) => {
                            const groupName = availableGroups.find((g) => g.id === target.groupId)?.subject || target.groupId;
                            return (
                              <div key={target.groupId} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 p-3">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{groupName}</p>
                                </div>

                                <div className="min-w-0 shrink md:w-32">
                                  <Select
                                    value={target.groupLevel}
                                    onValueChange={(value) =>
                                      setGroupLevelForTarget(
                                        target.groupId,
                                        (value === "LEVEL_2" ? "LEVEL_2" : value === "LEVEL_3" ? "LEVEL_3" : "LEVEL_1") as any,
                                      )
                                    }
                                    disabled={scheduleLoading || scheduleSaving}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="Selecione o nível">
                                        {target.groupLevel === "LEVEL_1" && "Nível 1"}
                                        {target.groupLevel === "LEVEL_2" && "Nível 2"}
                                        {target.groupLevel === "LEVEL_3" && "Nível 3"}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="LEVEL_1">Nível 1</SelectItem>
                                      <SelectItem value="LEVEL_2">Nível 2</SelectItem>
                                      <SelectItem value="LEVEL_3">Nível 3</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => removeAutoGroupTarget(target.groupId)}
                                  disabled={scheduleLoading || scheduleSaving}
                                  size="icon-sm"
                                  className="shrink-0"
                                  aria-label="Remover"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            )}

            {(initialNewsCaptureEnabled || initialAutoSendEnabled || initialGroupSendEnabled || initialLessonsConfirmationEnabled || user?.role === "ADMIN") && (
            <div className="flex justify-end">
              <Button onClick={handleSaveSchedule} disabled={scheduleSaving || scheduleLoading}>
                {scheduleSaving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={dailyRunDialogOpen} onOpenChange={handleDailyRunDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar Notícia e Quiz</DialogTitle>
            <DialogDescription>
              {runningDailyNews ? "Buscando a notícia do dia e validando o quiz." : "Confira o status da geração diária."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {runningDailyNews
                    ? "Processando notícias e quizzes..."
                    : dailyRunError
                      ? "Processamento finalizado com erro"
                      : "Processamento concluído"}
                </span>
                <span>{dailyRunProgress}%</span>
              </div>
              <Progress value={dailyRunProgress} className="h-2" />
            </div>

            {dailyRunError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-muted-foreground">
                {dailyRunError}
              </div>
            ) : null}

            {dailyRunResult ? (
              <div className="space-y-2 rounded-lg border p-3 text-sm">
                <p className="font-medium">Resumo</p>
                <p className="text-muted-foreground">
                  Notícias: {dailyRunResult?.news?.created || 0} criada(s) | {dailyRunResult?.news?.skippedSameDay || 0} bloqueio(s)
                  por dia | {dailyRunResult?.news?.skippedSameNews || 0} bloqueio(s) por mesma notícia
                </p>
                <p className="text-muted-foreground">
                  Quiz: {dailyRunResult?.quizzes?.created || 0} criado(s) | {dailyRunResult?.quizzes?.existing || 0} já existente(s)
                </p>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dispatchDialogOpen} onOpenChange={handleDispatchDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disparar Notícias em Lote</DialogTitle>
            <DialogDescription>Configure abaixo onde a notícia deve ser enviada. O envio roda em segundo plano.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Destinos do disparo</p>
                  <p className="text-xs text-muted-foreground">Escolha para onde a notícia será enviada.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={sendPrivateNews ? "default" : "outline"}
                  onClick={() => setSendPrivateNews((prev) => !prev)}
                  disabled={dispatching}
                >
                  Privado
                </Button>
                <Button
                  type="button"
                  variant={sendGroupNews ? "default" : "outline"}
                  onClick={() =>
                    setSendGroupNews((prev) => {
                      const next = !prev;
                      if (!next) {
                        setSelectedGroupId("");
                      } else if (availableGroups.length === 0) {
                        void fetchStoredGroups();
                      }
                      return next;
                    })
                  }
                  disabled={dispatching}
                >
                  Grupo
                </Button>
              </div>
            </div>

            {sendGroupNews ? (
              <div className="space-y-3 rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">Grupo da Notícia</p>
                  <p className="text-xs text-muted-foreground">Selecione um grupo já capturado na sincronização do WhatsApp.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="group-select">Grupo</Label>
                    </div>
                    <Select
                      value={selectedGroupId}
                      onValueChange={(value) => setSelectedGroupId(value || "")}
                      disabled={dispatching || groupOptionsLoading || availableGroups.length === 0}
                    >
                      <SelectTrigger id="group-select" className="w-full h-10">
                        <SelectValue placeholder="Selecione um grupo">
                          {availableGroups.find((group) => group.id === selectedGroupId)?.subject}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {availableGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="group-level-select">Nível da Notícia para o Grupo</Label>
                    </div>
                    <Select
                      value={selectedGroupLevel}
                      onValueChange={(value) => setSelectedGroupLevel(value || "LEVEL_1")}
                      disabled={dispatching || groupOptionsLoading || availableGroups.length === 0}
                    >
                      <SelectTrigger id="group-level-select" className="w-full h-10">
                        <SelectValue placeholder="Selecione o nível">
                          {selectedGroupLevel === "LEVEL_1" && "Nível 1"}
                          {selectedGroupLevel === "LEVEL_2" && "Nível 2"}
                          {selectedGroupLevel === "LEVEL_3" && "Nível 3"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LEVEL_1">Nível 1</SelectItem>
                        <SelectItem value="LEVEL_2">Nível 2</SelectItem>
                        <SelectItem value="LEVEL_3">Nível 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {groupConnectionReady === false ? (
                  <Alert variant="destructive">
                    <AlertTitle>WhatsApp desconectado</AlertTitle>
                    <AlertDescription>Conecte o WhatsApp para sincronizar os grupos e liberar o envio em grupo.</AlertDescription>
                  </Alert>
                ) : null}

                {groupConnectionReady && !groupOptionsLoading && availableGroups.length === 0 ? (
                  <Alert>
                    <AlertTitle>Nenhum grupo capturado</AlertTitle>
                    <AlertDescription>
                      {groupSyncStatus?.inProgress
                        ? "A sincronização está em andamento. Aguarde alguns instantes."
                        : "Seus grupos não foram encontrados no banco de dados. Vá para a tela de WhatsApp e sincronize novamente."}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            ) : null}

            {dispatching ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Iniciando disparo...</span>
                  <span>{dispatchProgress}%</span>
                </div>
                <Progress value={dispatchProgress} className="h-2" />
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => handleDispatchDialogChange(false)} disabled={dispatching}>
              Cancelar
            </Button>
            <Button onClick={handleDispatch} disabled={dispatching}>
              {dispatching ? "Processando..." : "Confirmar Disparo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

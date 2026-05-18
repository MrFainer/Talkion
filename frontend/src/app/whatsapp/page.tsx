"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";
import { QrCode, Smartphone, RefreshCw, LogOut } from "lucide-react";

const normalizeWhatsappStatus = (value: unknown) => {
  const raw = String(value || "").trim().toLowerCase();
  return ["open", "connected", "online"].includes(raw) ? "open" : raw;
};

const formatConnectedOwner = (owner: unknown) => {
  if (typeof owner === "string" && owner.length > 0) {
    return owner.split("@")[0];
  }

  if (owner && typeof owner === "object") {
    const candidateValues = [
      (owner as { ownerJid?: unknown }).ownerJid,
      (owner as { jid?: unknown }).jid,
      (owner as { id?: unknown }).id,
      (owner as { number?: unknown }).number,
      (owner as { phone?: unknown }).phone,
      (owner as { profileName?: unknown }).profileName,
      (owner as { name?: unknown }).name,
    ];

    const stringValue = candidateValues.find(
      (value) => typeof value === "string" && value.length > 0,
    );

    if (typeof stringValue === "string") {
      return stringValue.split("@")[0];
    }
  }

  return "Nao identificado";
};

type SyncStatusResponse = {
  connected: boolean;
  sync: {
    teacherId: string;
    stage: string;
    progress: number;
    message: string;
    inProgress: boolean;
    ready: boolean;
    stale: boolean;
    attempts: number;
    groupsCount: number;
    lastError: string | null;
    startedAt: string | null;
    completedAt: string | null;
    updatedAt: string;
  };
};

const syncStageLabel: Record<string, string> = {
  idle: "Aguardando",
  waiting_connection: "Aguardando conexao",
  warming_up: "Preparando",
  syncing_groups: "Sincronizando grupos",
  ready: "Pronto",
  degraded: "Pronto com cache",
  error: "Erro",
};

const formatDateTime = (value: string | null) => {
  if (!value) return "Nao disponivel";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Nao disponivel";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

export default function WhatsappPage() {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();
  const [status, setStatus] = useState<any>(null);
  const [qrCode, setQrCode] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse["sync"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const normalizedStatus = normalizeWhatsappStatus(status?.status);
  const syncProgress = syncStatus?.progress ?? 0;
  const syncStageText = syncStageLabel[syncStatus?.stage || "idle"] || "Aguardando";
  const syncSummary =
    syncStatus?.message ||
    (normalizedStatus === "open"
      ? "Clique em 'Sincronizar novamente' para buscar os grupos do aparelho."
      : "Conecte o WhatsApp para sincronizar.");

  useEffect(() => {
    document.title = "Talkion - WhatsApp";
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const fetchStatus = useCallback(async () => {
    if (!isHydrated) return;
    if (!user?.id) {
      router.push("/login");
      return;
    }
    try {
      const res = await api.get(`/whatsapp/status/${user.id}`);
      setStatus(res.data);
      setStatusError(null);
    } catch (error) {
      setStatus(null);
      setStatusError("Nao foi possivel consultar o status do WhatsApp.");
    }
  }, [isHydrated, user?.id, router]);

  const fetchSyncStatus = useCallback(async () => {
    if (!user?.id) return;

    try {
      const res = await api.get(`/whatsapp/sync-status/${user.id}`);
      setSyncStatus(res.data.sync);
    } catch {
      setSyncStatus(null);
    }
  }, [user?.id]);

  const fetchQrCode = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await api.get(`/whatsapp/qrcode/${user.id}`);
      setQrCode(res.data);
      setStatusError(null);
      if (normalizeWhatsappStatus(res.data.status) === "open") {
        await fetchStatus();
        await fetchSyncStatus();
      }
    } catch (error) {
      setQrCode(null);
      setStatusError("Nao foi possivel carregar o QR Code no momento.");
    }
  }, [fetchStatus, fetchSyncStatus, user?.id]);

  const handleSyncNow = useCallback(async () => {
    if (!user?.id) return;

    setSyncLoading(true);
    try {
      const res = await api.post(`/whatsapp/sync/${user.id}`);
      setSyncStatus(res.data.sync);
      toast.success("Sincronizacao do WhatsApp iniciada.");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Erro ao iniciar a sincronizacao.",
      );
    } finally {
      setSyncLoading(false);
    }
  }, [user?.id]);

  const initialLoad = useCallback(async () => {
    setLoading(true);
    await fetchStatus();
    await fetchQrCode();
    await fetchSyncStatus();
    setLoading(false);
  }, [fetchStatus, fetchQrCode, fetchSyncStatus]);

  useEffect(() => {
    initialLoad();
    const interval = setInterval(() => {
      if (normalizedStatus !== "open") {
        fetchQrCode();
      }
      if (normalizedStatus === "open" && user?.id) {
        fetchSyncStatus();
      }
    }, 5000); // Alterado para 5 segundos (5000ms)
    return () => clearInterval(interval);
  }, [normalizedStatus, initialLoad, fetchQrCode, fetchSyncStatus, user?.id]);

  useEffect(() => {
    if (normalizedStatus === "open" && user?.id) {
      fetchSyncStatus();
    }
  }, [normalizedStatus, fetchSyncStatus, user?.id]);

  const handleLogout = async () => {
    if (!user?.id) return;
    setActionLoading(true);
    try {
      await api.delete(`/whatsapp/logout/${user.id}`);
      toast.success("WhatsApp desconectado com sucesso.");
      setStatus(null);
      setQrCode(null);
      setSyncStatus(null);
      await initialLoad();
    } catch (error) {
      toast.error("Erro ao desconectar WhatsApp.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Conexão WhatsApp</h1>
          <Button variant="outline" size="icon" onClick={initialLoad} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Status da Instância
              </CardTitle>
              <CardDescription>Gerencie a conexão da sua instância com o WhatsApp.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {statusError ? (
                <p className="text-sm text-red-600">{statusError}</p>
              ) : null}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Status Atual</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {normalizedStatus === "open" ? "Conectado" : status?.status || "Desconectado"}
                  </p>
                </div>
                <div className={`h-3 w-3 rounded-full ${normalizedStatus === "open" ? "bg-green-500" : "bg-red-500"}`} />
              </div>

              {normalizedStatus === "open" && (
                <div className="pt-4 border-t">
                  <p className="text-sm mb-4"><strong>Número conectado:</strong> {formatConnectedOwner(status?.owner)}</p>
                  <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">
                        {syncStatus?.ready ? "WhatsApp sincronizado" : "Sincronizando WhatsApp"}
                      </span>
                      <span className="text-muted-foreground">
                        {syncStageText}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{syncSummary}</span>
                        <span>{syncProgress}%</span>
                      </div>
                      <Progress value={syncProgress} className="h-2" />
                    </div>

                    <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div>Grupos sincronizados: {syncStatus?.groupsCount ?? 0}</div>
                      <div>Tentativas: {syncStatus?.attempts ?? 0}</div>
                      <div>Ultima atualizacao: {formatDateTime(syncStatus?.updatedAt || null)}</div>
                      <div>Finalizado em: {formatDateTime(syncStatus?.completedAt || null)}</div>
                    </div>

                    {syncStatus?.stale ? (
                      <p className="text-xs text-amber-600">
                        Exibindo dados em cache. Os grupos mais recentes ainda podem nao ter aparecido.
                      </p>
                    ) : null}

                    {syncStatus?.lastError ? (
                      <p className="text-xs text-red-600">
                        Ultimo detalhe: {syncStatus.lastError}
                      </p>
                    ) : null}

                    <Button
                      variant="outline"
                      onClick={handleSyncNow}
                      disabled={syncLoading || syncStatus?.inProgress}
                      className="w-full"
                    >
                      {syncLoading || syncStatus?.inProgress
                        ? "Sincronizando..."
                        : "Sincronizar novamente"}
                    </Button>
                  </div>
                  <Button variant="destructive" onClick={handleLogout} disabled={actionLoading} className="w-full">
                    <LogOut className="h-4 w-4 mr-2" />
                    Desconectar Instância
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Conectar Aparelho
              </CardTitle>
              <CardDescription>Escaneie o QR Code abaixo para conectar o WhatsApp.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center min-h-[300px]">
              {loading ? (
                <p className="text-muted-foreground">Carregando...</p>
              ) : normalizedStatus === "open" ? (
                <div className="text-center space-y-2">
                  <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Smartphone className="h-8 w-8" />
                  </div>
                  <p className="font-medium text-lg">Aparelho Conectado</p>
                  <p className="text-sm text-muted-foreground">
                    {syncStatus?.ready
                      ? "O sistema esta pronto para enviar e receber mensagens."
                      : "O aparelho esta conectado. Sincronize os grupos para utiliza-los no disparo de mensagens."}
                  </p>
                  {!syncStatus?.ready ? (
                    <div className="mx-auto mt-4 w-full max-w-sm space-y-2 rounded-lg border bg-muted/40 p-4 text-left">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{syncSummary}</span>
                        <span>{syncProgress}%</span>
                      </div>
                      <Progress value={syncProgress} className="h-2" />
                    </div>
                  ) : null}
                </div>
              ) : qrCode?.qrcode?.base64 ? (
                <div className="text-center space-y-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCode.qrcode.base64} alt="WhatsApp QR Code" className="mx-auto rounded-xl border p-2 bg-white max-h-48 object-contain" />
                  <p className="text-sm text-muted-foreground">Abra o WhatsApp, vá em Aparelhos Conectados e escaneie o código.</p>
                </div>
              ) : (
                <p className="text-muted-foreground">Aguardando geração do QR Code...</p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}

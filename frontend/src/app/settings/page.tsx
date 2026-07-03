"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { useAuthStore } from "@/store/auth";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Users, Save, MessageSquare } from "lucide-react";

type WhatsappGroupOption = {
  id: string;
  subject: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();
  const { planName } = usePlanFeatures();
  const isFreePlan = planName === "Free";

  const [availableGroups, setAvailableGroups] = useState<WhatsappGroupOption[]>([]);
  const [groupOptionsLoading, setGroupOptionsLoading] = useState(false);
  const [groupConnectionReady, setGroupConnectionReady] = useState<boolean | null>(null);
  const [groupSendTime, setGroupSendTime] = useState("08:00");
  const [privateSendTime, setPrivateSendTime] = useState("08:00");
  const [autoGroupTargets, setAutoGroupTargets] = useState<
    Array<{ groupId: string; groupLevel: "LEVEL_1" | "LEVEL_2" | "LEVEL_3" }>
  >([]);
  const [groupSearch, setGroupSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => { document.title = "Talkion - Configurações"; }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (!user?.id) { router.push("/login"); }
  }, [isHydrated, user?.id]);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [scheduleRes, groupsRes] = await Promise.allSettled([
        api.get(`/message-settings/${user.id}`),
        api.get(`/whatsapp/groups/cached/${user.id}`),
      ]);

      if (scheduleRes.status === "fulfilled") {
        const s = scheduleRes.value.data;
        if (s.private_news_send_time) setPrivateSendTime(s.private_news_send_time);
        if (s.group_news_send_time) setGroupSendTime(s.group_news_send_time);
        if (s.auto_group_targets) setAutoGroupTargets(s.auto_group_targets);
      }

      if (groupsRes.status === "fulfilled") {
        const d = groupsRes.value.data;
        setAvailableGroups(d.groups || []);
        const connected = d.connected === true ? true : d.connected === false ? false : null;
        if (connected === false) {
          try {
            const statusRes = await api.get(`/whatsapp/status/${user.id}`);
            const raw = String(statusRes.data?.status || "").trim().toLowerCase();
            setGroupConnectionReady(["open", "connected", "online"].includes(raw));
          } catch { setGroupConnectionReady(false); }
        } else {
          setGroupConnectionReady(connected);
        }
      }
    } catch { toast.error("Erro ao carregar configurações."); }
    finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isGroupSelected = (groupId: string) => autoGroupTargets.some((t) => t.groupId === groupId);

  const addAutoGroupTarget = (groupId: string) => {
    if (isGroupSelected(groupId)) return;
    setAutoGroupTargets((prev) => [...prev, { groupId, groupLevel: "LEVEL_1" }]);
  };

  const removeAutoGroupTarget = (groupId: string) => {
    setAutoGroupTargets((prev) => prev.filter((t) => t.groupId !== groupId));
  };

  const setGroupLevelForTarget = (groupId: string, level: "LEVEL_1" | "LEVEL_2" | "LEVEL_3") => {
    setAutoGroupTargets((prev) => prev.map((t) => (t.groupId === groupId ? { ...t, groupLevel: level } : t)));
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await api.put(`/message-settings/${user.id}`, {
        private_news_send_time: privateSendTime,
        group_news_send_time: groupSendTime,
        auto_group_targets: autoGroupTargets,
      });
      toast.success("Configurações salvas!");
    } catch { toast.error("Erro ao salvar configurações."); }
    finally { setSaving(false); }
  };

  const availableGroupsFiltered = availableGroups.filter((g) =>
    g.subject.toLowerCase().includes(groupSearch.toLowerCase()),
  );

  if (loading) {
    return (
      <>
        <Sidebar />
        <main className="flex-1 min-w-0 p-4 pt-20 md:p-8 md:pt-8 flex items-center justify-center">
          <p className="text-muted-foreground">Carregando...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pt-20 md:p-8 md:pt-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
            <p className="text-muted-foreground mt-1">
              Configure o envio automático de notícias para grupos do WhatsApp.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Envio automático no privado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Seus alunos cadastrados receberão notícias, quizzes e conteúdos de inglês automaticamente
                no privado do WhatsApp todos os dias.
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <p>Será enviado diariamente às <strong>{isFreePlan ? "08:00" : privateSendTime}</strong></p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Envio automático em grupos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <p>Será enviado diariamente às <strong>{isFreePlan ? "08:00" : groupSendTime}</strong></p>
              </div>

              {groupConnectionReady === false ? (
                <Alert variant="destructive">
                  <AlertTitle>WhatsApp desconectado</AlertTitle>
                  <AlertDescription>Conecte o WhatsApp para sincronizar os grupos.</AlertDescription>
                </Alert>
              ) : null}

              {groupConnectionReady && !groupOptionsLoading && availableGroups.length === 0 ? (
                <Alert>
                  <AlertTitle>Nenhum grupo capturado</AlertTitle>
                  <AlertDescription>
                    Seus grupos não foram encontrados. Vá para a tela de WhatsApp e sincronize novamente.
                  </AlertDescription>
                </Alert>
              ) : null}

              {groupConnectionReady !== false && availableGroups.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <Label htmlFor="group-search">Lista de grupos</Label>
                    <Input
                      id="group-search"
                      placeholder="Buscar grupo..."
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                    />
                    <div className="rounded-md border max-h-72 overflow-y-auto">
                      {availableGroupsFiltered.length === 0 ? (
                        <p className="p-4 text-sm text-muted-foreground">Nenhum grupo encontrado.</p>
                      ) : (
                        <div className="divide-y">
                          {availableGroupsFiltered.map((group) => {
                            const selected = isGroupSelected(group.id);
                            return (
                              <div key={group.id} className="grid grid-cols-[1fr_auto] items-center gap-3 p-3">
                                <p className="truncate text-sm font-medium">{group.subject}</p>
                                <Button
                                  type="button"
                                  variant={selected ? "outline" : "default"}
                                  onClick={() => addAutoGroupTarget(group.id)}
                                  disabled={selected}
                                  size="sm"
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  {selected ? "Adicionado" : "Adicionar"}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Selecionados ({autoGroupTargets.length})</p>
                      {autoGroupTargets.length > 0 && (
                        <Button type="button" variant="outline" onClick={() => setAutoGroupTargets([])} size="sm">
                          Limpar
                        </Button>
                      )}
                    </div>

                    {autoGroupTargets.length === 0 ? (
                      <Alert>
                        <AlertTitle>Nenhum grupo selecionado</AlertTitle>
                        <AlertDescription>Selecione grupos ao lado para habilitar o envio automático.</AlertDescription>
                      </Alert>
                    ) : (
                      <div className="rounded-md border max-h-72 overflow-y-auto">
                        <div className="divide-y">
                          {autoGroupTargets.map((target) => {
                            const groupName = availableGroups.find((g) => g.id === target.groupId)?.subject || target.groupId;
                            return (
                              <div key={target.groupId} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 p-3">
                                <p className="truncate text-sm font-medium">{groupName}</p>
                                <Select
                                  value={target.groupLevel}
                                  onValueChange={(value) =>
                                    setGroupLevelForTarget(target.groupId, value as any)
                                  }
                                >
                                  <SelectTrigger className="h-8 w-28">
                                    <SelectValue>
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
                                <Button type="button" variant="outline" onClick={() => removeAutoGroupTarget(target.groupId)} size="icon-sm">
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

              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
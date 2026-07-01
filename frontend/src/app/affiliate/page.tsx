"use client";

import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Link2, Copy, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);

export default function AffiliatePage() {
  const { user, isHydrated, hydrate, subscriptionStatus, setSubscriptionData } = useAuthStore();
  const [link, setLink] = useState("");
  const [code, setCode] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [hasActivePlan, setHasActivePlan] = useState(false);
  const [checkingPlan, setCheckingPlan] = useState(true);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (subscriptionStatus) {
      setHasActivePlan(subscriptionStatus === 'active');
      setCheckingPlan(false);
    } else if (user?.id) {
      api.get(`/subscriptions/user/${user.id}`)
        .then(res => {
          const status = res.data?.status;
          setHasActivePlan(status === 'active');
          setSubscriptionData(status);
        })
        .catch(() => setHasActivePlan(false))
        .finally(() => setCheckingPlan(false));
    } else if (!user) {
      setCheckingPlan(false);
    }
  }, [user?.id, subscriptionStatus, setSubscriptionData]);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const [linkRes, statsRes] = await Promise.all([
        api.get(`/affiliate/link/${user.id}`),
        api.get(`/affiliate/stats/${user.id}`),
      ]);
      setLink(linkRes.data.link);
      setCode(linkRes.data.code);
      setStats(statsRes.data);
    } catch {
      toast.error("Erro ao carregar dados de afiliado");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  if (!isHydrated || !user) {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (checkingPlan) {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasActivePlan) {
    return (
      <>
        <Sidebar />
        <main className="flex-1 min-w-0 p-4 pt-20 md:p-8 md:pt-8">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <h1 className="text-3xl font-bold tracking-tight mb-4">Programa de Afiliados</h1>
            <p className="text-muted-foreground text-lg max-w-md">
              O programa de afiliados está disponível apenas para usuários com um plano ativo.
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pt-20 md:p-8 md:pt-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Programa de Afiliados</h1>
          <p className="text-muted-foreground mt-1">
            Divulgue o Talkion e ganhe comissão sobre cada novo professor que assinar pelo seu link
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              Seu Link de Afiliado
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando link...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border bg-muted px-3 py-2 text-sm break-all">
                  {link}
                </code>
                <button
                  onClick={handleCopy}
                  className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                >
                  {copied ? (
                    <><CheckCircle2 className="h-4 w-4" /> Copiado</>
                  ) : (
                    <><Copy className="h-4 w-4" /> Copiar</>
                  )}
                </button>
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Seu código: <strong>{code}</strong> &mdash; Compartilhe este link no Instagram, WhatsApp ou onde preferir.
            </p>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : stats ? (
          <>
            <div className="grid gap-4 md:grid-cols-1 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total de Indicações
                  </CardTitle>
                  <Users className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatNumber(stats.totalReferrals)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {stats.pendingCommissions?.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">
                    Últimas Comissões
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats.pendingCommissions.slice(0, 5).map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                        <span className="text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString("pt-BR")}
                        </span>
                        <span className="font-medium text-amber-600">
                          {formatCurrency(c.amount)}
                        </span>
                        <span className="text-xs text-muted-foreground rounded-full bg-amber-50 px-2 py-0.5">
                          Pendente
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {stats.referredUsers?.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Usuários Indicados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 font-medium">Nome</th>
                          <th className="pb-2 font-medium hidden sm:table-cell">E-mail</th>
                          <th className="pb-2 font-medium">Data</th>
                          <th className="pb-2 font-medium text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.referredUsers.map((u: any) => (
                          <tr key={u.id} className="border-b last:border-0">
                            <td className="py-2.5 pr-3">{u.name}</td>
                            <td className="py-2.5 pr-3 hidden sm:table-cell text-muted-foreground">{u.email}</td>
                            <td className="py-2.5 pr-3 text-muted-foreground whitespace-nowrap">
                              {new Date(u.created_at).toLocaleDateString("pt-BR")}
                            </td>
                            <td className="py-2.5 text-right">
                              {u.hasSubscription ? (
                                <span className="text-xs rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-600 font-medium">
                                  Assinou
                                </span>
                              ) : (
                                <span className="text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                                  Cadastrou
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </main>
    </>
  );
}

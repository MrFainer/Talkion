"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/Sidebar";
import { MercadoPagoCardPaymentBrick } from "@/components/MercadoPagoCardPaymentBrick";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Zap,
  CalendarDays,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Coins,
  History,
  ShoppingCart,
  Users,
  AlertCircle,
  CreditCard,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: "Ativa", color: "text-emerald-600 bg-emerald-50" },
  pending: { label: "Pendente", color: "text-amber-600 bg-amber-50" },
  paused: { label: "Pausada", color: "text-blue-600 bg-blue-50" },
  cancelled: { label: "Cancelada", color: "text-red-600 bg-red-50" },
  past_due: { label: "Pagamento Pendente", color: "text-red-600 bg-red-50" },
};

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "—";
  return new Date(dateStr + (dateStr.includes("T") ? "" : "T00:00:00")).toLocaleDateString("pt-BR");
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);

const getStartOfWeek = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const topUpPacks = [
  { id: 'topup_5000', name: '5.000 Créditos', price: 29.90, credits: 5000 },
  { id: 'topup_10000', name: '10.000 Créditos', price: 49.90, credits: 10000 },
  { id: 'topup_20000', name: '20.000 Créditos', price: 89.90, credits: 20000 },
];

const additionalStudentPrice = 2.99;

export default function SubscriptionsPage() {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showAddStudents, setShowAddStudents] = useState(false);
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [additionalQty, setAdditionalQty] = useState(1);
  const [currentStudents, setCurrentStudents] = useState(0);
  const [topUpStep, setTopUpStep] = useState<"select" | "payment">("select");
  const [topUpSubmitting, setTopUpSubmitting] = useState(false);
  const [topUpError, setTopUpError] = useState<string | null>(null);
  const [additionalStep, setAdditionalStep] = useState<"select" | "payment">("select");
  const [additionalLoading, setAdditionalLoading] = useState(false);
  const [additionalError, setAdditionalError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!isHydrated || !user?.id) return;
    try {
      setLoading(true);
      const [subRes, creditsRes, txnRes, studentsRes] = await Promise.allSettled([
        api.get(`/subscriptions/user/${user.id}`),
        api.get(`/credits/balance/${user.id}`),
        api.get(`/credits/transactions/${user.id}?limit=10`),
        api.get(`/subscriptions/user/${user.id}/current-students`),
      ]);
      if (subRes.status === "fulfilled") setSubscription(subRes.value.data);
      if (creditsRes.status === "fulfilled") setCreditBalance(creditsRes.value.data.balance);
      if (txnRes.status === "fulfilled") setTransactions(txnRes.value.data.data || []);
      if (studentsRes.status === "fulfilled") setCurrentStudents(studentsRes.value.data.count);
    } catch {
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isHydrated]);

  useEffect(() => { fetchSubscription(); }, [fetchSubscription]);

  useEffect(() => {
    document.title = "Talkion - Assinatura";
  }, []);

  useEffect(() => {
    if (!loading && !subscription) {
      router.replace("/subscriptions/checkout");
    }
  }, [loading, subscription, router]);

  const handleTopUpCardSubmit = async (cardToken: string) => {
    if (!selectedPack) return;
    setTopUpSubmitting(true);
    setTopUpError(null);
    try {
      const { data } = await api.post(`/subscriptions/user/${user!.id}/topup`, {
        packId: selectedPack,
        cardToken,
      });
      if (data.success) {
        toast.success(`${formatNumber(data.credits)} créditos adicionados!`);
        setShowTopUp(false);
        setSelectedPack(null);
        setTopUpStep("select");
        fetchSubscription();
      } else {
        setTopUpError("Pagamento não aprovado");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Erro na compra";
      setTopUpError(msg);
    } finally {
      setTopUpSubmitting(false);
    }
  };

  const handleAdditionalCardSubmit = async (cardToken: string) => {
    setAdditionalLoading(true);
    setAdditionalError(null);
    try {
      const { data } = await api.post(`/subscriptions/user/${user!.id}/additional-students`, {
        quantity: additionalQty,
        cardToken,
      });
      if (data.success) {
        toast.success(`${additionalQty} aluno(s) adicional(is) contratado(s)!`);
        setShowAddStudents(false);
        setAdditionalStep("select");
        fetchSubscription();
      } else {
        setAdditionalError("Pagamento não aprovado");
      }
    } catch (err: any) {
      setAdditionalError(err?.response?.data?.message || err?.message || "Erro na compra");
    } finally {
      setAdditionalLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    setShowCancelDialog(false);
    setCancelling(true);
    try {
      const cancelRes = await api.post(`/subscriptions/user/${user!.id}/cancel`);
      const { setSubscriptionData } = useAuthStore.getState();
      setSubscriptionData("cancelled", cancelRes.data?.next_billing_date || subscription?.next_billing_date || null);
      toast.success("Assinatura cancelada com sucesso");
      await fetchSubscription();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao cancelar assinatura");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <>
        <Sidebar />
        <main className="flex-1 min-w-0 p-4 pt-20 md:p-8 md:pt-8 flex items-center justify-center">
          <p className="text-muted-foreground">Carregando assinatura...</p>
        </main>
      </>
    );
  }

  const status = subscription ? statusLabels[subscription.status] || statusLabels.pending : null;
  const isCancelledWithFuture = subscription?.status === "cancelled" && subscription.next_billing_date && new Date(subscription.next_billing_date) > new Date();

  return (
    <>
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pt-20 md:p-8 md:pt-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Assinatura</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seu plano e forma de pagamento
          </p>
        </div>

        {isCancelledWithFuture ? (
          <div className="mb-6 flex items-start gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="font-medium text-amber-800">Sua assinatura foi cancelada</p>
              <p className="mt-1 text-sm text-amber-700">
                Ela continuará ativa até <strong>{formatDate(subscription.next_billing_date)}</strong>.
                Após essa data, você perderá acesso ao Talkion.
              </p>
            </div>
            <button
              onClick={() => router.push("/subscriptions/checkout")}
              className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
            >
              Reativar Assinatura
            </button>
          </div>
        ) : null}

        {!subscription ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Redirecionando para contratar plano...</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-500" />
                    Créditos Disponíveis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-3xl font-bold text-amber-600">
                        {formatNumber(creditBalance)}
                      </span>
                      <span className="text-sm text-muted-foreground ml-2">créditos</span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => { setShowTopUp(true); setTopUpStep("select"); setTopUpError(null); }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        <ShoppingCart className="h-4 w-4 shrink-0" />
                        Comprar Créditos
                      </button>
                      <button
                        onClick={() => { setShowAddStudents(true); setAdditionalStep("select"); setAdditionalError(null); }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
                      >
                        <Users className="h-4 w-4 shrink-0" />
                        + Alunos
                      </button>
                    </div>
                  </div>

                  {subscription?.plan?.credits > 0 && (() => {
                    const planCredits = subscription.plan.credits;
                    const bonusCredits = Math.max(0, creditBalance - planCredits);
                    const usedCredits = Math.min(creditBalance, planCredits);
                    const pct = Math.round((usedCredits / planCredits) * 100);
                    return (
                      <div className="mt-4 space-y-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Créditos do plano</span>
                            <span>{formatNumber(usedCredits)} / {formatNumber(planCredits)}</span>
                          </div>
                          <Progress value={pct} className="w-full" />
                        </div>
                        {bonusCredits > 0 && (
                          <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm">
                            <span className="flex items-center gap-1.5 text-amber-700">
                              <Zap className="h-3.5 w-3.5" />
                              Bônus (créditos extras)
                            </span>
                            <span className="font-semibold text-amber-700">+{formatNumber(bonusCredits)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                          <span>Total disponível</span>
                          <span className="font-semibold text-amber-600">{formatNumber(creditBalance)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    Detalhes do Plano
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b">
                      <span className="text-sm text-muted-foreground">Plano</span>
                      <span className="text-sm font-semibold">{subscription.plan?.name || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between pb-3 border-b">
                      <span className="text-sm text-muted-foreground">Valor Mensal</span>
                      <span className="text-sm font-semibold">
                        {formatCurrency(subscription.plan?.price || 0)}
                      </span>
                    </div>
                    {subscription.additional_students > 0 && (
                    <div className="flex items-center justify-between pb-3 border-b">
                      <span className="text-sm text-muted-foreground">Alunos Adicionais</span>
                      <span className="text-sm font-semibold">
                        +{formatCurrency(subscription.additional_students * additionalStudentPrice)}/mês
                      </span>
                    </div>
                    )}
                    <div className="flex items-center justify-between pb-3 border-b">
                      <span className="text-sm text-muted-foreground">Créditos por Ciclo</span>
                      <span className="text-sm font-semibold">
                        {formatNumber(subscription.plan?.credits || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pb-3 border-b">
                      <span className="text-sm text-muted-foreground">Limite de Alunos</span>
                      <span className="text-sm font-semibold">
                        {currentStudents} / {subscription.max_students + (subscription.additional_students || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pb-3 border-b">
                      <span className="text-sm text-muted-foreground">Alunos Adicionais</span>
                      <span className="text-sm font-semibold">
                        {subscription.additional_students > 0 ? `${subscription.additional_students} contratados` : 'Nenhum'}
                        {(() => {
                          const remaining = (subscription.max_students + (subscription.additional_students || 0)) - currentStudents;
                          return remaining > 0
                            ? <span className="ml-1.5 text-emerald-600">(+{remaining} disponíveis)</span>
                            : null;
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pb-3 border-b">
                      <span className="text-sm text-muted-foreground">Status</span>
                      {status && (
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${status.color}`}>
                          {subscription.status === "active" ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : subscription.status === "past_due" ? (
                            <AlertTriangle className="h-3.5 w-3.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          {status.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between pb-3 border-b">
                      <span className="text-sm text-muted-foreground">
                        {subscription.status === "cancelled" ? "Ativa até" : "Próxima Cobrança"}
                      </span>
                      <span className="text-sm font-semibold">
                        {formatDate(subscription.next_billing_date)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Cartão</span>
                      <span className="text-sm font-semibold">
                        {subscription.card_last_four
                          ? `•••• ${subscription.card_last_four}`
                          : "—"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    Últimas Transações de Créditos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {transactions.filter((tx: any) => new Date(tx.created_at) >= getStartOfWeek()).length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {transactions.filter((tx: any) => new Date(tx.created_at) >= getStartOfWeek()).map((tx: any) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5"
                        >
                          <div className="flex items-center gap-3">
                            {tx.type === "CREDIT" ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <Zap className="h-4 w-4 text-amber-500" />
                            )}
                            <div>
                              <p className="text-sm font-medium">{tx.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(tx.created_at).toLocaleDateString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-sm font-semibold ${tx.type === "CREDIT" ? "text-emerald-600" : "text-red-600"}`}>
                              {tx.type === "CREDIT" ? "+" : "-"}{formatNumber(tx.amount)}
                            </span>
                            <p className="text-xs text-muted-foreground">
                              Saldo: {formatNumber(tx.balance_after)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Nenhuma transação ainda.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Histórico de Pagamentos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {subscription.payments && subscription.payments.length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {subscription.payments.map((payment: any) => (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5"
                        >
                          <div className="flex items-center gap-3">
                            {payment.status === "approved" ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : payment.status === "rejected" ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            )}
                            <div>
                              <p className="text-sm font-medium">
                                {payment.status === "approved"
                                  ? "Pagamento aprovado"
                                  : payment.status === "rejected"
                                  ? "Pagamento recusado"
                                  : payment.status}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(payment.paid_at || payment.created_at)}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold">
                            {formatCurrency(payment.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Nenhum pagamento registrado ainda.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {!isCancelledWithFuture && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Ações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {subscription.status === "cancelled" ? (
                    <button
                      onClick={() => router.push("/subscriptions/checkout")}
                      className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                    >
                      <CreditCard className="h-4 w-4" />
                      Reativar Assinatura
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push("/subscriptions/checkout")}
                      className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
                    >
                      Alterar Plano
                    </button>
                  )}
                  {subscription.status === "active" || subscription.status === "pending" ? (
                    <button
                      onClick={() => setShowCancelDialog(true)}
                      disabled={cancelling}
                      className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
                      Cancelar Assinatura
                    </button>
                  ) : null}
                </CardContent>
              </Card>
            </div>
            )}
          </div>
        )}

        {showTopUp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="w-full max-w-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  {topUpStep === "select" ? "Comprar Créditos Extras" : "Pagamento"}
                </CardTitle>
              </CardHeader>

              {topUpStep === "select" && (
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    {topUpPacks.map((pack) => (
                      <button
                        key={pack.id}
                        onClick={() => setSelectedPack(pack.id)}
                        className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                          selectedPack === pack.id ? "border-primary bg-primary/5 ring-2 ring-primary" : "hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-amber-500" />
                          <span className="font-medium">{pack.name}</span>
                        </div>
                        <span className="font-bold">{formatCurrency(pack.price)}</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => { setShowTopUp(false); setSelectedPack(null); setTopUpStep("select"); }}
                      className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => { if (selectedPack) setTopUpStep("payment"); }}
                      disabled={!selectedPack}
                      className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <CreditCard className="h-4 w-4" /> Continuar
                    </button>
                  </div>
                </CardContent>
              )}

              {topUpStep === "payment" && (
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Pagamento de <strong>{formatCurrency(topUpPacks.find(p => p.id === selectedPack)?.price || 0)}</strong> por <strong>{topUpPacks.find(p => p.id === selectedPack)?.name}</strong>
                  </p>

                  <MercadoPagoCardPaymentBrick
                    amount={topUpPacks.find(p => p.id === selectedPack)?.price || 0}
                    onSubmit={handleTopUpCardSubmit}
                    onError={(err) => setTopUpError(err.message)}
                    buttonLabel={`Pagar R$ ${(topUpPacks.find(p => p.id === selectedPack)?.price || 0).toFixed(2)}`}
                  />

                  {topUpError && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{topUpError}</span>
                    </div>
                  )}

                  <div className="flex justify-center">
                    <button
                      onClick={() => { setTopUpStep("select"); setTopUpError(null); }}
                      className="text-sm text-muted-foreground hover:underline"
                    >
                      Voltar
                    </button>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        )}

        {showAddStudents && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="w-full max-w-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  {additionalStep === "select" ? "Alunos Adicionais" : "Pagamento"}
                </CardTitle>
              </CardHeader>

              {additionalStep === "select" && (
                <CardContent className="space-y-4">
                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="text-muted-foreground">
                      Atualmente você tem <strong>{currentStudents}</strong> alunos ativos e seu limite é de <strong>{subscription?.max_students || 0}</strong>.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium">Quantidade:</label>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setAdditionalQty(Math.max(1, additionalQty - 1))}
                        className="h-8 w-8 rounded-lg border flex items-center justify-center hover:bg-muted"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={additionalQty}
                        onChange={(e) => setAdditionalQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-8 w-16 rounded-lg border border-input bg-background px-2 text-sm text-center"
                      />
                      <button
                        onClick={() => setAdditionalQty(additionalQty + 1)}
                        className="h-8 w-8 rounded-lg border flex items-center justify-center hover:bg-muted"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-semibold">
                    Total: {formatCurrency(additionalQty * additionalStudentPrice)}/mês
                  </p>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setShowAddStudents(false)}
                      className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => setAdditionalStep("payment")}
                      disabled={additionalLoading}
                      className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <CreditCard className="h-4 w-4" /> Continuar
                    </button>
                  </div>
                </CardContent>
              )}

              {additionalStep === "payment" && (
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Pagamento de <strong>{formatCurrency(additionalQty * additionalStudentPrice)}</strong> por <strong>{additionalQty} aluno(s) adicional(is)</strong>
                  </p>

                  <MercadoPagoCardPaymentBrick
                    amount={additionalQty * additionalStudentPrice}
                    onSubmit={handleAdditionalCardSubmit}
                    onError={(err) => setAdditionalError(err.message)}
                    buttonLabel={`Pagar R$ ${(additionalQty * additionalStudentPrice).toFixed(2)}`}
                  />

                  {additionalError && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{additionalError}</span>
                    </div>
                  )}

                  <div className="flex justify-center">
                    <button
                      onClick={() => { setAdditionalStep("select"); setAdditionalError(null); }}
                      className="text-sm text-muted-foreground hover:underline"
                    >
                      Voltar
                    </button>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        )}
      </main>

      <Dialog
        open={showCancelDialog}
        onOpenChange={(open) => {
          if (cancelling) return;
          setShowCancelDialog(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Assinatura</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Sua assinatura continuará <strong>ativa até {formatDate(subscription?.next_billing_date)}</strong> após o cancelamento.
              Você não será cobrado novamente.
            </p>
            <p className="text-sm text-muted-foreground">
              Deseja realmente cancelar sua assinatura?
            </p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
            <button
              onClick={() => setShowCancelDialog(false)}
              disabled={cancelling}
              className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              Continuar Assinatura
            </button>
            <button
              onClick={handleConfirmCancel}
              disabled={cancelling}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar Cancelamento
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

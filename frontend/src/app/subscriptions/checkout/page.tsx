"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/Sidebar";
import { MercadoPagoCardPaymentBrick } from "@/components/MercadoPagoCardPaymentBrick";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, ArrowLeft, AlertCircle, CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);

export default function CheckoutPage() {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"plan" | "payment">("plan");
  const [existingSubscription, setExistingSubscription] = useState<any>(null);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [studentCount, setStudentCount] = useState<number>(0);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const ADDITIONAL_STUDENT_PRICE = 2.99;

  useEffect(() => { hydrate(); }, [hydrate]);

  const fetchData = useCallback(async () => {
    if (!isHydrated || !user?.id) return;
    try {
      setLoading(true);
      const [plansRes, subRes] = await Promise.allSettled([
        api.get("/subscriptions/plans"),
        api.get(`/subscriptions/user/${user.id}`),
      ]);

      if (plansRes.status === "fulfilled") setPlans(plansRes.value.data);

      if (subRes.status === "fulfilled") {
        setExistingSubscription(subRes.value.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user?.id, isHydrated]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    document.title = "Talkion - Contratar Plano";
  }, []);

  const isChangingPlan = existingSubscription?.status === "active";

  const handleSelectPlan = async (plan: any) => {
    if (isChangingPlan) {
      setSelectedPlan(plan);
      setErrorMessage(null);
      setSuccess(false);
      setLoadingStudents(true);
      try {
        const res = await api.get(`/subscriptions/user/${user!.id}/current-students`);
        setStudentCount(res.data.count);
      } catch {
        setStudentCount(0);
      } finally {
        setLoadingStudents(false);
      }
      setStep("payment");
      return;
    }
    setSelectedPlan(plan);
    setStep("payment");
    setErrorMessage(null);
    setSuccess(false);
    setLoadingStudents(true);
    try {
      const res = await api.get(`/subscriptions/user/${user!.id}/current-students`);
      setStudentCount(res.data.count);
    } catch {
      setStudentCount(0);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleConfirmChangePlan = async () => {
    if (!selectedPlan || !user?.id) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await api.patch(`/subscriptions/user/${user.id}/plan`, {
        planId: selectedPlan.id,
      });
      setSuccess(true);
      toast.success("Plano alterado com sucesso!");
      setTimeout(() => router.push("/subscriptions"), 2000);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Erro ao alterar plano";
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCardSubmit = async (cardToken: string) => {
    if (!selectedPlan || !user?.id) return;
    setErrorMessage(null);

    try {
      await api.post(`/subscriptions/user/${user.id}`, {
        planId: selectedPlan.id,
        cardToken,
      });
      setSuccess(true);
      toast.success("Assinatura criada com sucesso!");
      setTimeout(() => router.push("/subscriptions"), 2000);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Erro ao criar assinatura";
      setErrorMessage(message);
      throw err;
    }
  };

  if (loading) {
    return (
      <>
        <Sidebar />
        <main className="flex-1 min-w-0 p-4 pt-20 md:p-8 md:pt-8 flex items-center justify-center">
          <p className="text-muted-foreground">Carregando planos...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pt-20 md:p-8 md:pt-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">
            {existingSubscription?.status === "active" ? "Alterar Plano" : "Contratar Plano"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {existingSubscription?.status === "active"
              ? "Escolha um novo plano para sua assinatura"
              : "Escolha o plano ideal para você"}
          </p>
        </div>

        {step === "plan" && (
          <div className="grid gap-4 md:grid-cols-3 max-w-4xl">
            {plans.map((plan) => {
              const isCurrentPlan = existingSubscription?.status === "active" && (existingSubscription?.plan_id === plan.id || existingSubscription?.plan?.id === plan.id);
              const wasPreviousPlan = existingSubscription?.status === "cancelled" && (existingSubscription?.plan_id === plan.id || existingSubscription?.plan?.id === plan.id);
              return (
              <Card
                key={plan.id}
                className={`transition-all ${isCurrentPlan ? "ring-2 ring-emerald-500 border-emerald-500" : "cursor-pointer hover:shadow-md"} ${
                  selectedPlan?.id === plan.id && !isCurrentPlan
                    ? "ring-2 ring-primary border-primary"
                    : ""
                }`}
                onClick={() => !isCurrentPlan && handleSelectPlan(plan)}
              >
                <CardHeader className="pb-3 text-center">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {plan.description && (
                    <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                  )}
                </CardHeader>
                <CardContent className="text-center">
                  <div className="text-3xl font-bold mb-1">
                    {formatCurrency(plan.price)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">/mês</p>
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                    <Zap className="h-4 w-4" />
                    {formatNumber(plan.credits)} créditos/mês
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Alunos adicionais: {formatCurrency(ADDITIONAL_STUDENT_PRICE)}/mês cada
                  </p>
                  {isCurrentPlan ? (
                    <div className="mt-4 w-full rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm font-medium text-emerald-700 flex items-center justify-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Você está neste plano
                    </div>
                  ) : wasPreviousPlan ? (
                    <>
                      <div className="mt-3 w-full rounded-lg bg-muted border px-4 py-2 text-sm font-medium text-muted-foreground flex items-center justify-center gap-2">
                        Você estava neste plano
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSelectPlan(plan); }}
                        className="mt-2 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        Reativar
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSelectPlan(plan); }}
                      className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      {existingSubscription?.status === "active" ? "Alterar para este" : "Escolher"}
                    </button>
                  )}
                </CardContent>
              </Card>
            )})}
            {plans.length === 0 && (
              <div className="md:col-span-3 text-center py-12">
                <p className="text-muted-foreground">Nenhum plano disponível no momento.</p>
              </div>
            )}
          </div>
        )}

        {existingSubscription && step === "plan" && (
          <div className="mt-4">
            <Link
              href="/subscriptions"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para Assinatura
            </Link>
          </div>
        )}

        {step === "payment" && selectedPlan && (() => {
          const extraStudents = Math.max(0, studentCount - selectedPlan.max_students);
          const extraCost = extraStudents * ADDITIONAL_STUDENT_PRICE;
          const totalAmount = selectedPlan.price + extraCost;

          const oldTotal = existingSubscription?.plan?.price || 0;
          const diffToCharge = Math.max(0, totalAmount - oldTotal);

          return (
          <div className="max-w-lg">
            <Card className="mb-4">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Plano</span>
                  <span className="text-sm font-semibold">{selectedPlan.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Valor base</span>
                  <span className="text-sm">{formatCurrency(selectedPlan.price)}/mês</span>
                </div>

                {loadingStudents ? (
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Seus alunos</span>
                    <span>Verificando...</span>
                  </div>
                ) : studentCount > 0 ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Seus alunos ativos</span>
                      <span className="text-sm font-medium">{formatNumber(studentCount)} {studentCount === 1 ? 'aluno' : 'alunos'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Vagas inclusas no plano</span>
                      <span className="text-sm font-medium">{formatNumber(selectedPlan.max_students)} {selectedPlan.max_students === 1 ? 'vaga' : 'vagas'}</span>
                    </div>
                    {extraStudents > 0 && (
                      <div className="flex items-center justify-between text-amber-600">
                        <span className="text-sm">{formatNumber(extraStudents)} aluno(s) adicional(is) × {formatCurrency(ADDITIONAL_STUDENT_PRICE)}</span>
                        <span className="text-sm font-medium">+ {formatCurrency(extraCost)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Alunos cadastrados</span>
                    <span className="text-sm text-muted-foreground">Nenhum</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm font-semibold">Total mensal</span>
                  <span className="text-lg font-bold">{formatCurrency(totalAmount)}</span>
                </div>

                {isChangingPlan && (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700 space-y-1">
                    {diffToCharge > 0 ? (
                      <>
                        <p>
                          <strong>Plano atual:</strong> {existingSubscription?.plan?.name} ({formatCurrency(oldTotal)}/mês)
                        </p>
                        <p>
                          <strong>Novo plano:</strong> {selectedPlan.name} ({formatCurrency(totalAmount)}/mês)
                        </p>
                        <p>
                          Será cobrada a diferença proporcional aos dias restantes do ciclo no cartão <strong>•••• {existingSubscription?.card_last_four}</strong>.
                        </p>
                        <p className="text-xs">
                          Créditos serão resetados para {formatNumber(selectedPlan.credits)} e as vagas atualizadas para {selectedPlan.max_students}.
                        </p>
                      </>
                    ) : (
                      <>
                        <p>
                          <strong>Plano atual:</strong> {existingSubscription?.plan?.name}
                        </p>
                        <p>
                          <strong>Novo plano:</strong> {selectedPlan.name}
                        </p>
                        <p>
                          Nenhum valor adicional será cobrado agora. O novo valor de {formatCurrency(totalAmount)}/mês vigorará na próxima cobrança.
                        </p>
                        <p className="text-xs">
                          Créditos serão resetados para {formatNumber(selectedPlan.credits)} e as vagas atualizadas para {selectedPlan.max_students}.
                        </p>
                      </>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Recorrência</span>
                  <span className="text-sm font-medium text-emerald-600">
                    <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />
                    Mensal — mesmo valor todo mês
                  </span>
                </div>
              </CardContent>
            </Card>

            {success && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                    <h3 className="text-lg font-semibold">{isChangingPlan ? "Plano alterado com sucesso!" : "Assinatura criada com sucesso!"}</h3>
                    <p className="text-sm text-muted-foreground">
                      {isChangingPlan
                        ? "Seu novo plano já está valendo. Você será redirecionado em instantes."
                        : "Sua assinatura foi ativada. Você será redirecionado em instantes."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {!success && (
              <>
                {isChangingPlan ? (
                  <>
                    {errorMessage && (
                      <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{errorMessage}</span>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => { setStep("plan"); setErrorMessage(null); }}
                        disabled={submitting}
                        className="sm:flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleConfirmChangePlan}
                        disabled={submitting}
                        className="sm:flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        Confirmar Alteração
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-primary" />
                          Dados do Cartão
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="mb-4 text-sm text-muted-foreground">
                          Seus dados são processados com segurança pelo Mercado Pago. A cobrança de <strong>{formatCurrency(totalAmount)}</strong> será recorrente mensalmente.
                        </p>

                        {errorMessage && (
                          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{errorMessage}</span>
                          </div>
                        )}

                        <MercadoPagoCardPaymentBrick
                          amount={totalAmount}
                          onSubmit={handleCardSubmit}
                          onError={(err) => toast.error(err.message)}
                        />
                      </CardContent>
                    </Card>

                    <button
                      onClick={() => { setStep("plan"); setErrorMessage(null); }}
                      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mt-4"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Voltar para planos
                    </button>
                  </>
                )}
              </>
            )}

          </div>
        )})()}
      </main>
    </>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { MercadoPagoCardPaymentBrick } from "@/components/MercadoPagoCardPaymentBrick";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Zap, ArrowLeft, AlertCircle, CheckCircle2, CreditCard, Loader2,
  GraduationCap, Building2, HelpCircle, ChevronDown,
  Award, Mail, TrendingUp, Star, UserPlus, BarChart3, Shield,
  Headphones, LineChart, MessageSquare,
} from "lucide-react";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);

const ADDITIONAL_STUDENT_PRICE = 3.90;

type PlanStyle = {
  color: string;
  bgLight: string;
  border: string;
  ring: string;
  icon: any;
  buttonLabel: string;
  description: string;
};

const planStyles: Record<string, PlanStyle> = {
  Free: {
    color: "text-emerald-600",
    bgLight: "bg-emerald-50",
    border: "border-emerald-200",
    ring: "ring-emerald-500",
    icon: Zap,
    buttonLabel: "Começar Gratuitamente",
    description: "Comece gratuitamente. Sem cartão de crédito.",
  },
  Essentials: {
    color: "text-blue-600",
    bgLight: "bg-blue-50",
    border: "border-blue-200",
    ring: "ring-blue-500",
    icon: TrendingUp,
    buttonLabel: "Assinar Essentials",
    description: "Para professores que querem automatizar suas aulas.",
  },
  Professional: {
    color: "text-primary",
    bgLight: "bg-primary/10",
    border: "border-primary/30",
    ring: "ring-primary",
    icon: Award,
    buttonLabel: "Quero o Professional",
    description: "Cresça sem aumentar sua carga de trabalho.",
  },
  School: {
    color: "text-orange-600",
    bgLight: "bg-orange-50",
    border: "border-orange-200",
    ring: "ring-orange-500",
    icon: GraduationCap,
    buttonLabel: "Falar com Especialista",
    description: "Para escolas e equipes de professores.",
  },
};

const planFeatures: Record<string, string[]> = {
  Free: [
    "Até 3 alunos",
    "2.000 créditos",
    "Todas as funcionalidades",
    "Suporte por e-mail",
    "Sem cartão de crédito",
  ],
  Essentials: [
    "Até 50 alunos",
    "20.000 créditos/mês",
    "Tudo do plano Free",
    "Confirmação de aulas",
    "Relatórios de evolução",
    "Suporte online",
  ],
  Professional: [
    "Até 100 alunos",
    "50.000 créditos/mês",
    "Tudo do Essentials",
    "Suporte prioritário",
    "Maior capacidade de IA",
    "Melhor custo por aluno",
    "Relatórios completos",
    "Prioridade em novos recursos",
  ],
  School: [
    "Até 250 alunos",
    "120.000 créditos/mês",
    "Tudo do Premium",
    "Até 5 professores",
    "Dashboard administrativo",
    "Gestão de múltiplas turmas",
    "Onboarding personalizado",
    "Suporte dedicado",
  ],
};

const enterpriseFeatures = [
  "Professores ilimitados",
  "Alunos personalizados",
  "Créditos personalizados",
  "API e integrações",
  "SLA dedicado",
  "Treinamento da equipe",
  "Gerente de sucesso",
];

const faqItems = [
  {
    q: "Todos os planos possuem as mesmas funcionalidades?",
    a: "Sim! Todos os planos têm acesso às mesmas funcionalidades da plataforma. A diferença está na quantidade de alunos, créditos de IA e professores que você pode gerenciar.",
  },
  {
    q: "O plano gratuito tem limite de tempo?",
    a: "Não! O plano Free é totalmente gratuito, sem cartão de crédito. Você recebe 2.000 créditos para testar a plataforma com até 3 alunos.",
  },
  {
    q: "Os créditos acumulam?",
    a: "Créditos do plano são resetados todo mês na renovação. Já os créditos extras comprados à parte nunca expiram e se acumulam com os créditos do seu plano.",
  },
  {
    q: "Posso comprar mais créditos?",
    a: "Sim! Oferecemos pacotes de créditos extras a partir de R$ 39,90. Basta acessar a página de assinatura e escolher o pacote desejado.",
  },
  {
    q: "Posso mudar de plano?",
    a: "Sim! Você pode fazer upgrade ou downgrade quando quiser. O valor é recalculado proporcionalmente aos dias restantes do ciclo de faturamento.",
  },
  {
    q: "Como funciona o suporte?",
    a: "Todos os planos têm suporte por e-mail. Planos pagos contam com suporte online e o School tem suporte dedicado com onboarding personalizado.",
  },
];

const creditPacks = [
  { credits: "10.000", price: "R$ 39,90" },
  { credits: "25.000", price: "R$ 89,90" },
  { credits: "50.000", price: "R$ 169,90" },
  { credits: "100.000", price: "R$ 299,90" },
];

const comparisonRows = [
  { label: "Alunos", free: "3", essentials: "50", professional: "100", school: "250" },
  { label: "Créditos", free: "2.000", essentials: "20.000", professional: "50.000", school: "120.000" },
  { label: "Conteúdo diário IA", free: true, essentials: true, professional: true, school: true },
  { label: "Speaking IA", free: true, essentials: true, professional: true, school: true },
  { label: "Quiz inteligente", free: true, essentials: true, professional: true, school: true },
  { label: "Dashboard completo", free: "—", essentials: true, professional: true, school: true },
  { label: "Fluxos privados", free: true, essentials: true, professional: true, school: true },
  { label: "Fluxos em grupo", free: true, essentials: true, professional: true, school: true },
  { label: "Gestão de alunos", free: true, essentials: true, professional: true, school: true },
  { label: "Automações", free: "—", essentials: true, professional: true, school: true },
  { label: "Confirmação de aulas", free: "—", essentials: true, professional: true, school: true },
  { label: "Agendamento", free: "—", essentials: true, professional: true, school: true },
  { label: "Suporte prioritário", free: "—", essentials: "—", professional: true, school: true },
  { label: "Até 5 professores", free: "—", essentials: "—", professional: "—", school: true },
];

const differentials = [
  { icon: Shield, title: "Seguro e confiável", desc: "Seus dados protegidos com criptografia de ponta a ponta." },
  { icon: Headphones, title: "Suporte que entende", desc: "Nossa equipe é formada por professores e especialistas em educação." },
  { icon: LineChart, title: "Resultados reais", desc: "Veja a evolução dos seus alunos com relatórios detalhados." },
  { icon: MessageSquare, title: "No WhatsApp", desc: "Tudo acontece no canal que seus alunos já utilizam." },
];

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
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [contactModal, setContactModal] = useState<string | null>(null);
  const [contactMsg, setContactMsg] = useState("");
  const [contactSending, setContactSending] = useState(false);
  const preselectedPlan = useRef<string | null>(null);

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
      if (subRes.status === "fulfilled") setExistingSubscription(subRes.value.data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [user?.id, isHydrated]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const planName = params.get("plan");
    if (planName) {
      preselectedPlan.current = planName;
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    document.title = "Talkion - Planos";
  }, []);

  const isChangingPlan = existingSubscription?.status === "active" && !!existingSubscription?.card_last_four;

  useEffect(() => {
    if (!preselectedPlan.current || !plans.length || !user?.id) return;
    const planName = preselectedPlan.current;
    preselectedPlan.current = null;
    const plan = plans.find((p: any) => p.name === planName);
    if (plan) handleSelectPlan(plan);
  }, [plans, user?.id]);

  const handleSelectPlan = async (plan: any) => {
    if (plan.is_free) {
      setSelectedPlan(plan);
      setSubmitting(true);
      setErrorMessage(null);
      try {
        if (isChangingPlan) {
          await api.patch(`/subscriptions/user/${user!.id}/plan`, { planId: plan.id });
        } else {
          await api.post(`/subscriptions/user/${user!.id}`, { planId: plan.id });
        }
        setSuccess(true);
        toast.success("Plano gratuito ativado!");
        setTimeout(() => router.push("/subscriptions"), 2000);
      } catch (err: any) {
        const message = err?.response?.data?.message || err?.message || "Erro ao ativar plano gratuito";
        setErrorMessage(message);
        setSubmitting(false);
      }
      return;
    }
    if (isChangingPlan) {
      setSelectedPlan(plan);
      setErrorMessage(null);
      setSuccess(false);
      setLoadingStudents(true);
      try {
        const res = await api.get(`/subscriptions/user/${user!.id}/current-students`);
        setStudentCount(res.data.count);
      } catch { setStudentCount(0); }
      finally { setLoadingStudents(false); }
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
    } catch { setStudentCount(0); }
    finally { setLoadingStudents(false); }
  };

  const handleConfirmChangePlan = async () => {
    if (!selectedPlan || !user?.id) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await api.patch(`/subscriptions/user/${user.id}/plan`, { planId: selectedPlan.id });
      setSuccess(true);
      toast.success("Plano alterado com sucesso!");
      setTimeout(() => router.push("/subscriptions"), 2000);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Erro ao alterar plano";
      setErrorMessage(message);
    } finally { setSubmitting(false); }
  };

  const handleCardSubmit = async (cardToken: string, subscriptionCardToken?: string) => {
    if (!selectedPlan || !user?.id) return;
    setErrorMessage(null);
    try {
      await api.post(`/subscriptions/user/${user.id}`, {
        planId: selectedPlan.id, cardToken, subscriptionCardToken,
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

  const handleContactSubmit = async () => {
    if (!contactModal || !user) return;
    setContactSending(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: user.name,
          email: user.email,
          mensagem: contactMsg || `Tenho interesse no plano ${contactModal}`,
        }),
      });
      toast.success("Mensagem enviada! Em breve entraremos em contato.");
      setContactModal(null);
      setContactMsg("");
    } catch {
      toast.error("Erro ao enviar mensagem. Tente novamente.");
    } finally {
      setContactSending(false);
    }
  };

  if (loading) {
    return (
      <>
        <main className="flex-1 min-w-0 p-4 pt-20 md:p-8 md:pt-8 flex items-center justify-center">
          <p className="text-muted-foreground">Carregando planos...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <main className="flex-1 min-w-0 p-4 pt-20 md:p-8 md:pt-8">
        {step === "payment" && selectedPlan ? (() => {
          const extraStudents = Math.max(0, studentCount - selectedPlan.max_students);
          const extraCost = extraStudents * ADDITIONAL_STUDENT_PRICE;
          const totalAmount = selectedPlan.price + extraCost;
          const oldTotal = existingSubscription?.plan?.price || 0;
          const diffToCharge = Math.max(0, totalAmount - oldTotal);

          return (
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => { setStep("plan"); setErrorMessage(null); }}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para planos
            </button>

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
                        <p><strong>Plano atual:</strong> {existingSubscription?.plan?.name} ({formatCurrency(oldTotal)}/mês)</p>
                        <p><strong>Novo plano:</strong> {selectedPlan.name} ({formatCurrency(totalAmount)}/mês)</p>
                        <p>Será cobrada a diferença proporcional aos dias restantes do ciclo no cartão <strong>•••• {existingSubscription?.card_last_four}</strong>.</p>
                        <p className="text-xs">Créditos serão resetados para {formatNumber(selectedPlan.credits)} e as vagas atualizadas para {selectedPlan.max_students}.</p>
                      </>
                    ) : (
                      <>
                        <p><strong>Plano atual:</strong> {existingSubscription?.plan?.name}</p>
                        <p><strong>Novo plano:</strong> {selectedPlan.name}</p>
                        <p>Nenhum valor adicional será cobrado agora. O novo valor de {formatCurrency(totalAmount)}/mês vigorará na próxima cobrança.</p>
                        <p className="text-xs">Créditos serão resetados para {formatNumber(selectedPlan.credits)} e as vagas atualizadas para {selectedPlan.max_students}.</p>
                      </>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Recorrência</span>
                  <span className="text-sm font-medium text-emerald-600">
                    <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />
                    Mensal
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
                      {isChangingPlan ? "Seu novo plano já está valendo." : "Sua assinatura foi ativada."}
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
                      <button onClick={() => { setStep("plan"); setErrorMessage(null); }} disabled={submitting}
                        className="sm:flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
                        Cancelar
                      </button>
                      <button onClick={handleConfirmChangePlan} disabled={submitting}
                        className="sm:flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
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
                          generateSubscriptionToken
                        />
                      </CardContent>
                    </Card>
                  </>
                )}
              </>
            )}
          </div>
          );
        })() : (
        <>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-4">
                PLANOS
              </span>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
                Um plano para cada fase<br />
                da sua <span className="text-primary">jornada como professor</span>
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Todos os planos possuem as mesmas funcionalidades. A diferença está na quantidade de alunos,
                créditos de IA e professores que você pode gerenciar.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-16">
              {plans.map((plan) => {
                const style = planStyles[plan.name];
                const features = planFeatures[plan.name] || [];
                const isCurrentPlan = existingSubscription?.status === "active" && (existingSubscription?.plan_id === plan.id || existingSubscription?.plan?.id === plan.id);
                const wasPreviousPlan = existingSubscription?.status === "cancelled" && (existingSubscription?.plan_id === plan.id || existingSubscription?.plan?.id === plan.id);
                const isPopular = plan.name === "Professional";

                return (
                <Card
                  key={plan.id}
                  className={`flex flex-col transition-all duration-200 rounded-xl ${
                    isCurrentPlan ? `ring-2 ring-emerald-500 border-emerald-500` :
                    isPopular && !isCurrentPlan ? `overflow-visible ring-2 ${style?.ring || "ring-primary"} border-2 ${style?.border || "border-primary/30"} shadow-lg scale-[1.02]` :
                    "hover:shadow-md border"
                  } ${isPopular && !isCurrentPlan ? "pt-0" : ""}`}
                >
                  {isPopular && !isCurrentPlan && (
                    <div className="flex justify-center -mt-3 mb-0 relative">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
                        <Star className="h-3 w-3" />
                        MAIS POPULAR
                      </span>
                    </div>
                  )}

                  <CardHeader className={`pb-2 text-center ${isPopular && !isCurrentPlan ? "pt-2" : ""}`}>
                    {style && (
                      <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${style.bgLight}`}>
                        <style.icon className={`h-6 w-6 ${style.color}`} />
                      </div>
                    )}
                    <CardTitle className={`text-xl ${style?.color || ""}`}>{plan.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{style?.description}</p>
                  </CardHeader>

                  <CardContent className="text-center flex-1 flex flex-col px-4">
                    <div className="mb-3">
                      {plan.is_free ? (
                        <>
                          <div className="text-3xl font-bold text-emerald-600">R$ 0</div>
                          <p className="text-xs text-muted-foreground">/mês</p>
                        </>
                      ) : (
                        <>
                          <div className="text-3xl font-bold">{formatCurrency(plan.price)}</div>
                          <p className="text-xs text-muted-foreground">/mês</p>
                        </>
                      )}
                    </div>

                    <div className={`inline-flex items-center gap-1.5 rounded-full ${style?.bgLight || "bg-muted"} px-3 py-1 text-xs font-medium ${style?.color || ""} mx-auto mb-4`}>
                      <Zap className="h-3 w-3" />
                      {formatNumber(plan.credits)} créditos/mês
                    </div>

                    <ul className="space-y-2 text-left mb-4 flex-1">
                      {features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>

                    <p className="text-[11px] text-muted-foreground mb-3">
                      Aluno adicional: {formatCurrency(ADDITIONAL_STUDENT_PRICE)}/mês
                    </p>

                    {isCurrentPlan ? (
                      <div className="mt-auto w-full rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-700 flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Plano atual
                      </div>
                    ) : wasPreviousPlan ? (
                      <div className="mt-auto space-y-2">
                        <div className="w-full rounded-lg bg-muted border px-3 py-2 text-xs font-medium text-muted-foreground text-center">
                          Você estava neste plano
                        </div>
                        <button onClick={() => handleSelectPlan(plan)}
                          className={`w-full rounded-lg ${style?.bgLight || "bg-primary/10"} ${style?.color || "text-primary"} px-3 py-2 text-xs font-semibold hover:opacity-80 transition-opacity`}>
                          Reativar
                        </button>
                      </div>
                    ) : plan.name === "School" ? (
                      <button onClick={() => setContactModal("School")}
                        className="mt-auto w-full rounded-lg bg-orange-50 text-orange-700 px-3 py-2.5 text-xs font-semibold hover:bg-orange-100 transition-colors">
                        Falar com Especialista
                      </button>
                    ) : (
                      <button onClick={() => handleSelectPlan(plan)}
                        disabled={submitting && selectedPlan?.id === plan.id}
                        className={`mt-auto w-full rounded-lg ${style?.bgLight || "bg-primary/10"} ${style?.color || "text-primary"} px-3 py-2.5 text-xs font-semibold hover:opacity-80 transition-opacity disabled:opacity-50`}>
                        {submitting && selectedPlan?.id === plan.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        ) : (
                          style?.buttonLabel || "Escolher"
                        )}
                      </button>
                    )}
                  </CardContent>
                </Card>
              )})}

              <Card className="flex flex-col transition-all duration-200 rounded-xl hover:shadow-md border">
                <CardHeader className="pb-2 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                    <Building2 className="h-6 w-6 text-slate-700" />
                  </div>
                  <CardTitle className="text-xl text-slate-700">Enterprise</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Para escolas e redes de ensino.</p>
                </CardHeader>

                <CardContent className="text-center flex-1 flex flex-col px-4">
                  <div className="mb-3">
                    <div className="text-lg font-bold text-slate-700">Sob consulta</div>
                  </div>

                  <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 mx-auto mb-4">
                    <Zap className="h-3 w-3" />
                    Créditos personalizados
                  </div>

                  <ul className="space-y-2 text-left mb-4 flex-1">
                    {enterpriseFeatures.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <p className="text-[11px] text-muted-foreground mb-3">&nbsp;</p>

                  <button onClick={() => setContactModal("Enterprise")}
                    className="mt-auto w-full rounded-lg bg-slate-900 text-white px-3 py-2.5 text-xs font-semibold hover:bg-slate-800 transition-colors inline-flex items-center justify-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Solicitar Proposta
                  </button>
                </CardContent>
              </Card>
            </div>

            <section className="mb-16">
              <h2 className="text-2xl font-bold mb-8">Compare todos os planos</h2>
              <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Recursos</th>
                        {["Free", "Essentials", "Professional", "School"].map(name => (
                          <th key={name} className={`px-4 py-3 text-center font-semibold ${planStyles[name]?.color || ""}`}>
                            {name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                          <td className="px-4 py-2.5 text-muted-foreground">{row.label}</td>
                          {(["free", "essentials", "professional", "school"] as const).map(key => {
                            const val = row[key];
                            return (
                              <td key={key} className="px-4 py-2.5 text-center">
                                {val === true ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                                ) : (
                                  <span className="text-muted-foreground">{String(val)}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-4 w-full lg:w-72">
                  <Card>
                    <CardContent className="pt-5">
                      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-500" />
                        Créditos adicionais
                      </h3>
                      <p className="text-xs text-muted-foreground mb-4">
                        Pacotes de créditos extras que nunca expiram.
                      </p>
                      <div className="space-y-2">
                        {creditPacks.map((pack, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{pack.credits} créditos</span>
                            <span className="font-semibold">{pack.price}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-5">
                      <h3 className="font-semibold text-sm mb-3">O que são créditos?</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                        Cada recurso de IA consome créditos. Seus créditos são renovados mensalmente com a assinatura.
                      </p>
                      <ul className="space-y-1.5">
                        {["Conteúdo personalizado", "Quizzes", "Speaking", "Transcrição", "Texto para voz", "Geração de imagens"].map((item, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </section>

            <section className="mb-16">
              <h2 className="text-2xl font-bold mb-6">Perguntas frequentes</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {faqItems.map((item, i) => (
                  <Card key={i} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    <CardContent className="pt-5">
                      <div className="flex items-start justify-between mb-2">
                        <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                      </div>
                      <h3 className="font-semibold text-sm mb-1">{item.q}</h3>
                      {openFaq === i && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.a}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <section className="mb-8">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {differentials.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <Card key={i} className="border-0 bg-muted/30">
                      <CardContent className="pt-6 text-center">
                        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <h3 className="font-semibold text-sm mb-1">{item.title}</h3>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>

            {existingSubscription && (
              <div className="mb-8">
                <Link href="/subscriptions"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para Assinatura
                </Link>
              </div>
            )}
          </div>
        </>
        )}

        {contactModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Tenho interesse no plano {contactModal}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Seu nome</label>
                  <input
                    value={user?.name || ""}
                    disabled
                    className="w-full rounded-lg border bg-muted px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Seu e-mail</label>
                  <input
                    value={user?.email || ""}
                    disabled
                    className="w-full rounded-lg border bg-muted px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Mensagem (opcional)</label>
                  <textarea
                    value={contactMsg}
                    onChange={(e) => setContactMsg(e.target.value)}
                    placeholder={`Conte mais sobre sua necessidade com o plano ${contactModal}...`}
                    rows={3}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setContactModal(null); setContactMsg(""); }}
                    className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleContactSubmit}
                    disabled={contactSending}
                    className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {contactSending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Enviar
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </>
  );
}


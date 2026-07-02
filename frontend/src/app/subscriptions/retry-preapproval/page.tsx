"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, CreditCard, Loader2, ShieldCheck } from "lucide-react";

export default function RetryPreapprovalPage() {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();
  const [subscription, setSubscription] = useState<any>(null);
  const [cvv, setCvv] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    document.title = "Talkion - Ativar Cobrança Recorrente";
  }, []);

  useEffect(() => {
    if (!isHydrated || !user?.id) return;
    setLoading(true);
    api.get(`/subscriptions/user/${user.id}`)
      .then((res) => setSubscription(res.data))
      .catch(() => setError("Não foi possível carregar sua assinatura"))
      .finally(() => setLoading(false));
  }, [user?.id, isHydrated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const { data } = await api.post(`/subscriptions/user/${user.id}/retry-preapproval`, { cvv });
      setSuccess(true);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Erro ao ativar recorrência";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isHydrated || loading) {
    return (
      <>
        <Sidebar />
        <main className="flex-1 min-w-0 p-4 pt-20 md:p-8 md:pt-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
      </>
    );
  }

  if (error && !subscription) {
    return (
      <>
        <Sidebar />
        <main className="flex-1 min-w-0 p-4 pt-20 md:p-8 md:pt-8">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  const cardLastFour = subscription?.card_last_four || "****";
  const planName = subscription?.plan?.name || subscription?.plan_name || "—";

  return (
    <>
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pt-20 md:p-8 md:pt-8">
        <div className="max-w-md mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ativar Cobrança Recorrente</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sua assinatura foi criada, mas a cobrança mensal automática precisa ser ativada.
              Digite o CVV do cartão salvo para confirmar.
            </p>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                Cartão Salvo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Plano</span>
                <span className="font-medium">{planName}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Cartão</span>
                <span className="font-medium">•••• {cardLastFour}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Próxima cobrança</span>
                <span className="font-medium">
                  {subscription?.next_billing_date
                    ? new Date(subscription.next_billing_date).toLocaleDateString("pt-BR")
                    : "Em 30 dias"}
                </span>
              </div>
            </CardContent>
          </Card>

          {success && (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="pt-6 text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                <p className="font-semibold text-emerald-800">Cobrança recorrente ativada!</p>
                <p className="text-sm text-emerald-600">
                  A próxima cobrança será em {subscription?.next_billing_date
                    ? new Date(subscription.next_billing_date).toLocaleDateString("pt-BR")
                    : "30 dias"}.
                </p>
              </CardContent>
            </Card>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="cvv">CVV do cartão •••• {cardLastFour}</Label>
                <Input
                  id="cvv"
                  inputMode="numeric"
                  placeholder="123"
                  maxLength={4}
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, ""))}
                  className="h-9"
                  required
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  O CVV é enviado com segurança ao Mercado Pago para validar o cartão. Nenhum valor será cobrado agora.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting || cvv.length < 3}
                className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Ativando...</>
                ) : (
                  <>Ativar Cobrança Recorrente</>
                )}
              </button>
            </form>
          )}
        </div>
      </main>
    </>
  );
}

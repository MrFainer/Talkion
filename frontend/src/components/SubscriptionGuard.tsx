"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { useRouter, usePathname } from "next/navigation";
import api from "@/lib/api";
import { Loader2, AlertTriangle, CreditCard, Zap } from "lucide-react";

const EXEMPT_PATHS = ["/login", "/", "/subscriptions", "/admin", "/billing"];

export default function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { user, isHydrated, subscriptionStatus, subscriptionNextBillingDate, setSubscriptionData } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const fetchedRef = useRef(false);
  const [trialCredits, setTrialCredits] = useState<number | null>(null);
  const [checkingCredits, setCheckingCredits] = useState(false);

  useEffect(() => {
    if (!isHydrated) return;

    if (!user || user.role === "ADMIN" || EXEMPT_PATHS.some((p) => pathname.startsWith(p))) {
      return;
    }

    if (subscriptionStatus) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchStatus = async () => {
      try {
        const res = await api.get(`/subscriptions/user/${user.id}`);
        setSubscriptionData(res.data?.status || null, res.data?.next_billing_date || null);
      } catch {
        setSubscriptionData("none");
      }
    };

    fetchStatus();
  }, [user, isHydrated, pathname, subscriptionStatus, setSubscriptionData]);

  useEffect(() => {
    if (subscriptionStatus === "none" && user?.id && trialCredits === null && !checkingCredits) {
      setCheckingCredits(true);
      api.get(`/credits/balance/${user.id}`)
        .then((res) => setTrialCredits(res.data.balance ?? 0))
        .catch(() => setTrialCredits(0))
        .finally(() => setCheckingCredits(false));
    }
  }, [subscriptionStatus, user?.id, trialCredits, checkingCredits]);

  if (!isHydrated) return null;

  const exempt = !user || user.role === "ADMIN" || EXEMPT_PATHS.some((p) => pathname.startsWith(p));

  if (!subscriptionStatus && !exempt) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (exempt || subscriptionStatus === "active" || subscriptionStatus === "pending" || subscriptionStatus === "paused") {
    return <>{children}</>;
  }

  if (subscriptionStatus === "cancelled") {
    const isBeforeExpiry = subscriptionNextBillingDate && new Date(subscriptionNextBillingDate) > new Date();
    if (isBeforeExpiry) {
      return <>{children}</>;
    }
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <CreditCard className="h-8 w-8 text-amber-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Assinatura encerrada</h2>
            <p className="mt-2 text-muted-foreground">
              Sua assinatura foi cancelada e o período de acesso expirou.
            </p>
          </div>
          <button
            onClick={() => router.push("/subscriptions/checkout")}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <CreditCard className="h-4 w-4" />
            Ver Planos
          </button>
        </div>
      </div>
    );
  }

  if (subscriptionStatus === "none") {
    if (checkingCredits || trialCredits === null) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (trialCredits > 0) {
      return (
        <>
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-sm text-amber-800 flex items-center justify-center gap-2 flex-wrap">
            <Zap className="h-4 w-4 shrink-0" />
            <span>
              Você está no período de teste com <strong>{trialCredits.toLocaleString("pt-BR")} créditos</strong>.
              Quando acabar, assine um plano para continuar usando o Talkion.
            </span>
            <button
              onClick={() => router.push("/subscriptions/checkout")}
              className="ml-2 shrink-0 rounded-lg bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200 transition-colors"
            >
              Ver Planos
            </button>
          </div>
          {children}
        </>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <CreditCard className="h-8 w-8 text-amber-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Créditos esgotados</h2>
            <p className="mt-2 text-muted-foreground">
              Seus créditos de teste acabaram. Assine um plano para continuar usando o Talkion.
            </p>
          </div>
          <button
            onClick={() => router.push("/subscriptions/checkout")}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <CreditCard className="h-4 w-4" />
            Ver Planos
          </button>
        </div>
      </div>
    );
  }

  if (subscriptionStatus === "past_due") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Pagamento pendente</h2>
            <p className="mt-2 text-muted-foreground">
              Sua assinatura está com pagamento pendente. Regularize para continuar usando o Talkion.
            </p>
          </div>
          <button
            onClick={() => router.push("/subscriptions")}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <CreditCard className="h-4 w-4" />
            Regularizar Pagamento
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

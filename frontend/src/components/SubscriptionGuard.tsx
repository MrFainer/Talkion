"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { useRouter, usePathname } from "next/navigation";
import api from "@/lib/api";
import { Loader2, AlertTriangle, CreditCard, Zap } from "lucide-react";

const EXEMPT_PATHS = ["/login", "/", "/subscriptions", "/admin", "/billing", "/welcome"];
const REFRESH_INTERVAL_MS = 60_000;

export default function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { user, isHydrated, subscriptionStatus, subscriptionNextBillingDate, setSubscriptionData } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [trialCredits, setTrialCredits] = useState<number | null>(null);
  const [checkingCredits, setCheckingCredits] = useState(false);

  const exempt =
    !user || user.role === "ADMIN" || EXEMPT_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!isHydrated || exempt) return;

    let cancelled = false;

    const fetchStatus = async () => {
      try {
        const res = await api.get(`/subscriptions/user/${user.id}`);
        if (cancelled) return;
        setSubscriptionData(res.data?.status || null, res.data?.next_billing_date || null);
      } catch {
        if (cancelled) return;
        setSubscriptionData("none");
      }
    };

    fetchStatus();

    const intervalId = setInterval(fetchStatus, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [user, isHydrated, exempt, setSubscriptionData]);

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

  if (!subscriptionStatus && !exempt) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (exempt) {
    return <>{children}</>;
  }

  const deadline = subscriptionNextBillingDate
    ? new Date(subscriptionNextBillingDate)
    : null;
  const deadlineInFuture =
    deadline !== null && deadline.getTime() > new Date().getTime();
  const pastDeadline =
    deadline !== null && deadline.getTime() <= new Date().getTime();

  const renderBlocked = (
    title: string,
    message: string,
    buttonLabel: string,
    target: string,
  ) => (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-8 w-8 text-red-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="mt-2 text-muted-foreground">{message}</p>
        </div>
        <button
          onClick={() => router.push(target)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <CreditCard className="h-4 w-4" />
          {buttonLabel}
        </button>
      </div>
    </div>
  );

  if (subscriptionStatus === "cancelled") {
    if (!deadlineInFuture) {
      return renderBlocked(
        "Assinatura encerrada",
        "Sua assinatura foi cancelada e o período de acesso expirou.",
        "Ver Planos",
        "/subscriptions/checkout",
      );
    }
    return <>{children}</>;
  }

  if (subscriptionStatus === "past_due") {
    if (!deadlineInFuture) {
      return renderBlocked(
        "Pagamento pendente",
        "Sua assinatura está com pagamento pendente. Regularize para continuar usando o Talkion.",
        "Regularizar Pagamento",
        "/subscriptions",
      );
    }
    return <>{children}</>;
  }

  if (
    subscriptionStatus === "active" ||
    subscriptionStatus === "pending" ||
    subscriptionStatus === "paused"
  ) {
    if (pastDeadline) {
      return renderBlocked(
        "Pagamento pendente",
        "O período pago da sua assinatura expirou. Regularize o pagamento para continuar usando o Talkion.",
        "Regularizar Pagamento",
        "/subscriptions",
      );
    }
    return <>{children}</>;
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

    return renderBlocked(
      "Créditos esgotados",
      "Seus créditos de teste acabaram. Assine um plano para continuar usando o Talkion.",
      "Ver Planos",
      "/subscriptions/checkout",
    );
  }

  return <>{children}</>;
}

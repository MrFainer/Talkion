"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/auth";
import { useRouter, usePathname } from "next/navigation";
import api from "@/lib/api";
import { Loader2, AlertTriangle, CreditCard } from "lucide-react";

const EXEMPT_PATHS = ["/login", "/subscriptions", "/admin", "/billing"];

export default function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { user, isHydrated, subscriptionStatus, subscriptionNextBillingDate, setSubscriptionData } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const fetchedRef = useRef(false);

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
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <CreditCard className="h-8 w-8 text-amber-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Nenhum plano ativo</h2>
            <p className="mt-2 text-muted-foreground">
              Você precisa contratar um plano para usar o Talkion.
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

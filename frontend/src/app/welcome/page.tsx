"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import api from "@/lib/api";
import {
  Zap,
  Users,
  MessageSquare,
  CreditCard,
  ArrowRight,
  Bot,
  FileText,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";

export default function WelcomePage() {
  const router = useRouter();
  const { user, isHydrated } = useAuthStore();
  const { features, planName, loading: featuresLoading } = usePlanFeatures();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (isHydrated && !user) {
      router.push("/login");
    }
  }, [isHydrated, user, router]);

  useEffect(() => {
    if (user?.id) {
      api
        .get(`/credits/balance/${user.id}`)
        .then((res) => setCredits(res.data.balance ?? 0))
        .catch(() => setCredits(0));
    }
  }, [user?.id]);

  if (!isHydrated || !user) return null;

  const availableFeatures = [
    {
      icon: <Users className="h-5 w-5" />,
      title: "Gerenciar Alunos",
      description: "Cadastre e acompanhe seus alunos",
      href: "/students",
      available: true,
    },
    {
      icon: <MessageSquare className="h-5 w-5" />,
      title: "WhatsApp",
      description: "Conecte seu WhatsApp e envie mensagens",
      href: "/whatsapp",
      available: true,
    },
  ];

  const premiumFeatures = [
    {
      icon: <Bot className="h-5 w-5" />,
      title: "Automação",
      description: "Automatize tarefas repetitivas",
      available: features.automations,
    },
    {
      icon: <FileText className="h-5 w-5" />,
      title: "Content Studio",
      description: "Crie conteúdo personalizado com IA",
      available: features.content_studio,
    },
    {
      icon: <CalendarDays className="h-5 w-5" />,
      title: "Aulas",
      description: "Agende e gerencie suas aulas",
      available: features.lesson_confirmation,
    },
  ];

  return (
    <>
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="min-h-full bg-gradient-to-br from-slate-50 to-blue-50 p-4 pt-20 md:p-8 md:pt-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                <Zap className="h-8 w-8" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900">
                Bem-vindo ao Talkion!
              </h1>
              <p className="mt-2 text-lg text-slate-600">
                Você está no período de teste com{" "}
                <span className="font-semibold text-blue-600">
                  {credits !== null ? credits.toLocaleString("pt-BR") : "..."} créditos
                </span>
              </p>
            </div>

            <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                  <CreditCard className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900">
                    Seus créditos de teste
                  </h3>
                  <p className="mt-1 text-sm text-amber-700">
                    Você tem{" "}
                    <strong>{credits !== null ? credits.toLocaleString("pt-BR") : "..."} créditos</strong>{" "}
                    para testar o Talkion. Quando acabar, assine um plano para continuar.
                  </p>
                  <Link href="/subscriptions/checkout">
                    <Button
                      size="sm"
                      className="mt-3 bg-amber-600 text-white hover:bg-amber-700"
                    >
                      Ver Planos
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
                Funcionalidades Disponíveis
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {availableFeatures.map((feature) => (
                  <div
                    key={feature.title}
                    className={`group relative rounded-xl border p-4 transition-all ${
                      feature.available
                        ? "border-blue-200 bg-white hover:border-blue-300 hover:shadow-md cursor-pointer"
                        : "border-slate-200 bg-slate-50 opacity-60"
                    }`}
                    onClick={() => feature.available && router.push(feature.href)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          feature.available
                            ? "bg-blue-100 text-blue-600"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {feature.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-slate-900">
                          {feature.title}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {feature.description}
                        </p>
                      </div>
                      {feature.available && (
                        <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:text-blue-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
                Desbloqueie Mais Funcionalidades
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {premiumFeatures.map((feature) => (
                  <div
                    key={feature.title}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                      {feature.icon}
                    </div>
                    <h3 className="mt-3 font-medium text-slate-900">
                      {feature.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {feature.description}
                    </p>
                    <span className="mt-2 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      Plano pago
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center">
              <Link href="/subscriptions/checkout">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg hover:from-blue-700 hover:to-blue-800"
                >
                  <CreditCard className="mr-2 h-5 w-5" />
                  Assinar um Plano
                </Button>
              </Link>
              <p className="mt-3 text-sm text-slate-500">
                Escolha o plano ideal para você e desbloqueie todas as funcionalidades
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

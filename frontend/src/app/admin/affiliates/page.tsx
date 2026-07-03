"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Coins,
  Copy,
  Link2,
  Users,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type AffiliateReferral = {
  id: string;
  name: string;
  email: string;
  created_at: string;
  referred_by: string | null;
  source_type: string;
  subscription: {
    id: string;
    status: string;
    created_at: string;
    plan_name: string | null;
  } | null;
  commission: {
    id: string;
    amount: number;
    status: string;
    created_at: string;
    paid_at: string | null;
    subscription_id: string | null;
  } | null;
};

type AffiliateRow = {
  id: string;
  name: string;
  email: string;
  created_at: string;
  referral_code: string | null;
  referral_link: string | null;
  total_referrals: number;
  converted_referrals: number;
  pending_commissions: number;
  paid_commissions: number;
  total_commissions: number;
  referrals: AffiliateReferral[];
};

type AffiliateResponse = {
  overview: {
    total_affiliates: number;
    affiliates_with_referrals: number;
    total_referrals: number;
    converted_referrals: number;
    pending_commissions: number;
    paid_commissions: number;
    conversion_rate: number;
  };
  data: AffiliateRow[];
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);

const formatPercent = (value: number) =>
  `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format((value || 0) * 100)}%`;

const statusPillClass = (status?: string | null) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "paid" || normalized === "active") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (normalized === "pending") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  return "bg-slate-50 text-slate-700 border-slate-200";
};

export default function AdminAffiliatesPage() {
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<AffiliateResponse["overview"] | null>(null);
  const [affiliates, setAffiliates] = useState<AffiliateRow[]>([]);
  const [expandedAffiliateId, setExpandedAffiliateId] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const fetchAffiliates = useCallback(async () => {
    if (!isHydrated) return;
    if (!user?.id || user.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }

    try {
      setLoading(true);
      const res = await api.get("/admin/affiliates");
      setOverview(res.data?.overview || null);
      setAffiliates(res.data?.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao carregar afiliados.");
    } finally {
      setLoading(false);
    }
  }, [isHydrated, router, user?.id, user?.role]);

  useEffect(() => {
    document.title = "Talkion - Afiliados Admin";
  }, []);

  useEffect(() => {
    fetchAffiliates();
  }, [fetchAffiliates]);

  const copyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  if (!isHydrated || loading) {
    return (
      <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-4 pt-20 md:p-8 md:pt-8 flex items-center justify-center">
        <p>Carregando afiliados...</p>
      </main>
    );
  }

  return (
    <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-4 pt-20 md:p-8 md:pt-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Afiliados</h1>
          <p className="mt-2 text-muted-foreground">
            Veja quais professores indicaram novos usuários, o código usado no cadastro, a assinatura e as comissões.
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de afiliados</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Users className="h-5 w-5 text-primary" />
              {overview?.total_affiliates || 0}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Afiliados com indicados</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Link2 className="h-5 w-5 text-primary" />
              {overview?.affiliates_with_referrals || 0}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de indicados</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              {overview?.total_referrals || 0}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Taxa de conversão</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Coins className="h-5 w-5 text-primary" />
              {formatPercent(overview?.conversion_rate || 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Comissões pendentes</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(overview?.pending_commissions || 0)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Comissões pagas</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(overview?.paid_commissions || 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Professores Afiliados</CardTitle>
          <CardDescription>
            Expanda cada linha para ver os usuários indicados, assinatura e comissão.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {affiliates.length === 0 ? (
            <p className="text-muted-foreground">Nenhum afiliado encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Afiliado</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Indicados</TableHead>
                    <TableHead>Convertidos</TableHead>
                    <TableHead>Pendente</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {affiliates.map((affiliate) => (
                    <React.Fragment key={affiliate.id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() =>
                          setExpandedAffiliateId((current) =>
                            current === affiliate.id ? null : affiliate.id,
                          )
                        }
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {expandedAffiliateId === affiliate.id ? (
                              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <div>
                              <p>{affiliate.name}</p>
                              <p className="text-xs text-muted-foreground">{affiliate.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{affiliate.referral_code || "-"}</TableCell>
                        <TableCell>{affiliate.total_referrals}</TableCell>
                        <TableCell>{affiliate.converted_referrals}</TableCell>
                        <TableCell>{formatCurrency(affiliate.pending_commissions)}</TableCell>
                        <TableCell>{formatCurrency(affiliate.paid_commissions)}</TableCell>
                        <TableCell>{formatDate(affiliate.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {affiliate.referral_code ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  copyText(
                                    affiliate.referral_code as string,
                                    "Código do afiliado copiado.",
                                  );
                                }}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            ) : null}
                            {affiliate.referral_link ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  copyText(
                                    affiliate.referral_link as string,
                                    "Link do afiliado copiado.",
                                  );
                                }}
                              >
                                <Link2 className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>

                      {expandedAffiliateId === affiliate.id ? (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-slate-50/60">
                            {affiliate.referrals.length === 0 ? (
                              <p className="py-2 text-sm text-muted-foreground">
                                Este afiliado ainda não trouxe nenhum usuário.
                              </p>
                            ) : (
                              <div className="space-y-3 py-2">
                                {affiliate.referrals.map((referral) => (
                                  <div
                                    key={referral.id}
                                    className="rounded-xl border border-slate-200 bg-white p-4"
                                  >
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                      <div className="space-y-1">
                                        <p className="font-medium text-slate-900">{referral.name}</p>
                                        <p className="text-sm text-slate-500">{referral.email}</p>
                                        <p className="text-xs text-slate-500">
                                          Cadastro: {formatDate(referral.created_at)}
                                        </p>
                                      </div>

                                      <div className="flex flex-wrap gap-2">
                                        <span
                                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusPillClass(
                                            referral.subscription?.status || "sem_assinatura",
                                          )}`}
                                        >
                                          {referral.subscription?.status
                                            ? `Assinatura: ${referral.subscription.status}`
                                            : "Sem assinatura"}
                                        </span>
                                        <span
                                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusPillClass(
                                            referral.commission?.status || "sem_comissao",
                                          )}`}
                                        >
                                          {referral.commission?.status
                                            ? `Comissão: ${referral.commission.status}`
                                            : "Sem comissão"}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                      <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                          Origem
                                        </p>
                                        <p className="mt-1 text-sm text-slate-800">
                                          Código do professor
                                        </p>
                                        <p className="text-xs text-slate-500">
                                          Código usado: {referral.referred_by || "-"}
                                        </p>
                                      </div>

                                      <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                          Assinatura
                                        </p>
                                        <p className="mt-1 text-sm text-slate-800">
                                          {referral.subscription?.plan_name || "Nenhum plano"}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                          {referral.subscription
                                            ? `Criada em ${formatDate(referral.subscription.created_at)}`
                                            : "Ainda não assinou"}
                                        </p>
                                      </div>

                                      <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                          Comissão
                                        </p>
                                        <p className="mt-1 text-sm text-slate-800">
                                          {referral.commission
                                            ? formatCurrency(referral.commission.amount)
                                            : formatCurrency(0)}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                          {referral.commission?.paid_at
                                            ? `Paga em ${formatDate(referral.commission.paid_at)}`
                                            : referral.commission
                                              ? `Criada em ${formatDate(referral.commission.created_at)}`
                                              : "Sem comissão gerada"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

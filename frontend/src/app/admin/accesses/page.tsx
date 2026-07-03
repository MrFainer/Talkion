"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Monitor, MousePointerClick, Smartphone, Globe, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type SiteVisit = {
  id: string;
  page_type: "HOME" | "LOGIN" | "REGISTER";
  source_type: "DIRECT" | "REFERRAL_LINK";
  path: string;
  full_url: string | null;
  referral_code: string | null;
  referrer_url: string | null;
  referer_header: string | null;
  ip_address: string | null;
  user_agent: string | null;
  browser_name: string | null;
  os_name: string | null;
  device_type: string | null;
  device_vendor: string | null;
  device_model: string | null;
  platform: string | null;
  language: string | null;
  screen_width: number | null;
  screen_height: number | null;
  timezone: string | null;
  created_at: string;
};

type SiteVisitResponse = {
  overview: {
    total_visits: number;
    visits_today: number;
    home_visits: number;
    login_visits: number;
    register_visits: number;
    referral_visits: number;
    direct_visits: number;
  };
  period?: {
    from: string | null;
    to: string | null;
  };
  data: SiteVisit[];
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

const pageLabel: Record<SiteVisit["page_type"], string> = {
  HOME: "Home",
  LOGIN: "Login",
  REGISTER: "Criar Conta",
};

const sourceLabel: Record<SiteVisit["source_type"], string> = {
  DIRECT: "Acesso direto",
  REFERRAL_LINK: "Link do professor",
};

const PAGE_FILTER_ALL = "Todas as páginas";
const SOURCE_FILTER_ALL = "Todas as origens";

const formatInputDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDefaultRange = () => {
  const today = new Date();
  const oneMonthAgo = new Date(today);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  return {
    from: formatInputDate(oneMonthAgo),
    to: formatInputDate(today),
  };
};

export default function AdminAccessesPage() {
  const defaultRange = getDefaultRange();
  const router = useRouter();
  const { user, isHydrated, hydrate } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<SiteVisitResponse["overview"] | null>(null);
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [pageFilter, setPageFilter] = useState(PAGE_FILTER_ALL);
  const [sourceFilter, setSourceFilter] = useState(SOURCE_FILTER_ALL);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);
  const [appliedFrom, setAppliedFrom] = useState(defaultRange.from);
  const [appliedTo, setAppliedTo] = useState(defaultRange.to);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const fetchVisits = useCallback(async () => {
    if (!isHydrated) return;
    if (!user?.id || user.role !== "ADMIN") {
      router.push("/billing");
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (appliedFrom) params.append("from", `${appliedFrom}T00:00:00`);
      if (appliedTo) params.append("to", `${appliedTo}T23:59:59`);

      const res = await api.get(
        `/admin/site-visits${params.toString() ? `?${params.toString()}` : ""}`,
      );
      setOverview(res.data?.overview || null);
      setVisits(res.data?.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Erro ao carregar acessos.");
    } finally {
      setLoading(false);
    }
  }, [appliedFrom, appliedTo, isHydrated, router, user?.id, user?.role]);

  useEffect(() => {
    document.title = "Talkion - Acessos";
  }, []);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  const handleFilter = () => {
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
  };

  const handleClearFilters = () => {
    const range = getDefaultRange();
    setFromDate(range.from);
    setToDate(range.to);
    setAppliedFrom(range.from);
    setAppliedTo(range.to);
    setPageFilter(PAGE_FILTER_ALL);
    setSourceFilter(SOURCE_FILTER_ALL);
    setSearch("");
  };

  const filteredVisits = useMemo(() => {
    const searchNormalized = search.trim().toLowerCase();

    return visits.filter((visit) => {
      if (pageFilter !== PAGE_FILTER_ALL && pageLabel[visit.page_type] !== pageFilter) return false;
      if (sourceFilter !== SOURCE_FILTER_ALL && sourceLabel[visit.source_type] !== sourceFilter) return false;

      if (!searchNormalized) return true;

      const haystack = [
        visit.path,
        visit.full_url,
        visit.referral_code,
        visit.referrer_url,
        visit.referer_header,
        visit.ip_address,
        visit.browser_name,
        visit.os_name,
        visit.device_type,
        visit.device_vendor,
        visit.device_model,
        visit.platform,
        visit.language,
        visit.user_agent,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(searchNormalized);
    });
  }, [pageFilter, search, sourceFilter, visits]);

  if (!isHydrated || loading) {
    return (
      <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-4 pt-20 md:p-8 md:pt-8 flex items-center justify-center">
        <p>Carregando acessos...</p>
      </main>
    );
  }

  return (
    <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-4 pt-20 md:p-8 md:pt-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Acessos</h1>
        <p className="mt-2 text-muted-foreground">
          Acompanhe quem acessa a home, login e criar conta, com dados do navegador, referer e uso de link do professor.
        </p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de acessos</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <MousePointerClick className="h-5 w-5 text-primary" />
              {overview?.total_visits || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Acessos hoje</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Globe className="h-5 w-5 text-primary" />
              {overview?.visits_today || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Via link do professor</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Monitor className="h-5 w-5 text-primary" />
              {overview?.referral_visits || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Acesso direto</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Smartphone className="h-5 w-5 text-primary" />
              {overview?.direct_visits || 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Home</CardDescription>
            <CardTitle className="text-2xl">{overview?.home_visits || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Login</CardDescription>
            <CardTitle className="text-2xl">{overview?.login_visits || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Criar conta</CardDescription>
            <CardTitle className="text-2xl">{overview?.register_visits || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimos acessos</CardTitle>
          <CardDescription>
            Filtre por página ou origem. A tabela mostra os acessos recentes ao site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_180px_180px_150px_150px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por URL, referer, dispositivo, IP ou código..."
                  className="h-9 pl-9"
                />
              </div>
              <Select value={pageFilter} onValueChange={(value) => setPageFilter(value || PAGE_FILTER_ALL)}>
                <SelectTrigger className="h-9 w-full min-w-0">
                  <SelectValue placeholder="Página" />
                </SelectTrigger>
                <SelectContent
                  side="bottom"
                  align="start"
                  sideOffset={4}
                  alignItemWithTrigger={false}
                >
                  <SelectItem value={PAGE_FILTER_ALL}>{PAGE_FILTER_ALL}</SelectItem>
                  <SelectItem value="Home">Home</SelectItem>
                  <SelectItem value="Login">Login</SelectItem>
                  <SelectItem value="Criar Conta">Criar conta</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value || SOURCE_FILTER_ALL)}>
                <SelectTrigger className="h-9 w-full min-w-0">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent
                  side="bottom"
                  align="start"
                  sideOffset={4}
                  alignItemWithTrigger={false}
                >
                  <SelectItem value={SOURCE_FILTER_ALL}>{SOURCE_FILTER_ALL}</SelectItem>
                  <SelectItem value="Acesso direto">Acesso direto</SelectItem>
                  <SelectItem value="Link do professor">Link do professor</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="h-9 w-full min-w-0 focus-visible:ring-0 focus-visible:border-primary transition-colors [&::-webkit-calendar-picker-indicator]:opacity-40 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                aria-label="Data inicial"
              />
              <Input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="h-9 w-full min-w-0 focus-visible:ring-0 focus-visible:border-primary transition-colors [&::-webkit-calendar-picker-indicator]:opacity-40 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                aria-label="Data final"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                disabled={loading}
                className="h-9"
              >
                Limpar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleFilter}
                disabled={loading}
                className="h-9"
              >
                Filtrar
              </Button>
            </div>
          </div>

          <div className="mb-4 text-sm text-muted-foreground">
            Período aplicado:{" "}
            <span className="font-medium text-foreground">
              {appliedFrom || "início"}
            </span>{" "}
            até{" "}
            <span className="font-medium text-foreground">
              {appliedTo || "agora"}
            </span>
          </div>

          {filteredVisits.length === 0 ? (
            <p className="text-muted-foreground">Nenhum acesso encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Página</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Dispositivo</TableHead>
                    <TableHead>Navegador / SO</TableHead>
                    <TableHead>Referer</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVisits.map((visit) => (
                    <TableRow key={visit.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(visit.created_at)}</TableCell>
                      <TableCell>{pageLabel[visit.page_type]}</TableCell>
                      <TableCell>{sourceLabel[visit.source_type]}</TableCell>
                      <TableCell>{visit.referral_code || "-"}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p>{visit.device_type || "-"}</p>
                          <p className="text-xs text-muted-foreground">
                            {[visit.device_vendor, visit.device_model].filter(Boolean).join(" ") || "-"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {visit.screen_width && visit.screen_height
                              ? `${visit.screen_width}x${visit.screen_height}`
                              : "-"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p>{visit.browser_name || "-"}</p>
                          <p className="text-xs text-muted-foreground">{visit.os_name || "-"}</p>
                          <p className="text-xs text-muted-foreground">
                            {[visit.platform, visit.language, visit.timezone].filter(Boolean).join(" | ") || "-"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[220px] whitespace-normal break-all text-xs text-muted-foreground">
                        {visit.referrer_url || visit.referer_header || "-"}
                      </TableCell>
                      <TableCell className="max-w-[240px] whitespace-normal break-all text-xs text-muted-foreground">
                        {visit.full_url || visit.path}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{visit.ip_address || "-"}</TableCell>
                    </TableRow>
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

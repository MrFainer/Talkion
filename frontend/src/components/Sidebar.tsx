"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useSettingsStore } from "@/store/settings";
import api from "@/lib/api";
import {
  Home,
  Users,
  Wallet,
  LayoutDashboard,
  CreditCard,
  MessageCircle,
  Bot,
  Menu,
  X,
  LogOut,
  MessageSquare,
  Settings,
  ChevronDown,
  Link2,
  CalendarDays,
  Coins,
  FileText,
  Activity,
} from "lucide-react";

const normalizeWhatsappStatus = (value: unknown) => {
  const raw = String(value || "").trim().toLowerCase();
  return ["open", "connected", "online"].includes(raw) ? "open" : raw;
};

type SidebarNavLink = {
  href: string;
  label: string;
  icon: any;
};

type SidebarNavChildLink = {
  href: string;
  label: string;
};

type SidebarNavProps = {
  compact?: boolean;
  isAdmin: boolean;
  logoSrc: string;
  links: SidebarNavLink[];
  whatsappChildren: SidebarNavChildLink[];
  pathname: string;
  isWhatsappSectionActive: boolean;
  isWhatsappMenuOpen: boolean;
  onToggleWhatsappMenu: () => void;
  shouldInterceptClick: (event: React.MouseEvent) => boolean;
  onNavigate: (href: string) => void;
  onCloseMobile: () => void;
  userName?: string;
  userEmail?: string;
  whatsappStatus: string;
  creditBalance?: number | null;
  hasActivePlan?: boolean | null;
  planName?: string | null;
  onLogout: () => void;
};

function SidebarLoadingShell({ logoSrc }: { logoSrc: string }) {
  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b bg-background px-4 md:hidden">
        <div className="flex items-center gap-2">
          <Image
            src={logoSrc}
            alt="Talkion"
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 object-contain"
            unoptimized
          />
          <span className="text-lg font-semibold leading-none tracking-tight text-[#18181b]">
            Talkion
          </span>
        </div>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>

      <div className="hidden w-64 shrink-0 md:block" aria-hidden="true" />
      <aside className="fixed left-0 top-0 z-40 hidden h-[100dvh] w-64 border-r bg-background md:flex md:flex-col">
        <div className="border-b px-6 py-5">
          <div className="flex items-center gap-2.5">
            <Image
              src={logoSrc}
              alt="Talkion"
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 object-contain"
              unoptimized
            />
            <span className="text-2xl font-semibold leading-none tracking-tight text-[#18181b]">
              Talkion
            </span>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <p className="text-sm text-muted-foreground">Carregando menu...</p>
          </div>
        </div>
      </aside>
    </>
  );
}

function SidebarNav({
  compact,
  isAdmin,
  logoSrc,
  links,
  whatsappChildren,
  pathname,
  isWhatsappSectionActive,
  isWhatsappMenuOpen,
  onToggleWhatsappMenu,
  shouldInterceptClick,
  onNavigate,
  onCloseMobile,
  userName,
  userEmail,
  whatsappStatus,
  creditBalance,
  hasActivePlan,
  planName,
  onLogout,
}: SidebarNavProps) {
  return (
    <>
      <div className="border-b px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Image src={logoSrc} alt="Talkion" width={32} height={32} className="h-8 w-8 shrink-0 object-contain" unoptimized />
            <span className="text-2xl font-semibold leading-none tracking-tight text-[#18181b] truncate">
              Talkion
            </span>
          </div>
          {compact ? (
            <button
              type="button"
              onClick={onCloseMobile}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {isAdmin ? (
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Administração
          </div>
        ) : null}
        {links.map((link) => {
          const Icon = link.icon;
          const isUsersRootLink = link.href === "/admin/users";
          const isActive = isUsersRootLink
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={(e) => {
                if (!shouldInterceptClick(e)) return;
                e.preventDefault();
                onNavigate(link.href);
              }}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{link.label}</span>
            </Link>
          );
        })}

        {!isAdmin ? (
          <>
            <div className="pt-2">
              <button
                type="button"
                onClick={onToggleWhatsappMenu}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isWhatsappSectionActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                }`}
              >
                <MessageCircle className="h-4 w-4" />
                <span className="flex-1 text-left">WhatsApp</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isWhatsappMenuOpen ? "rotate-180" : ""}`} />
              </button>

              <div
                className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
                  isWhatsappMenuOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="mt-1 space-y-1 pl-6">
                    {whatsappChildren.map((child) => {
                      const isActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={(e) => {
                            if (!shouldInterceptClick(e)) return;
                            e.preventDefault();
                            onNavigate(child.href);
                          }}
                          className={`flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                            isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {child.href === "/settings" ? (
                            <Settings className="h-4 w-4" />
                          ) : child.href === "/messages" ? (
                            <MessageSquare className="h-4 w-4" />
                          ) : child.href === "/whatsapp" ? (
                            <Link2 className="h-4 w-4" />
                          ) : (
                            <span className="h-4 w-4" />
                          )}
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              {(() => {
                const Icon = CreditCard;
                const isActive = pathname === "/subscriptions" || pathname.startsWith("/subscriptions/");
                return (
                  <Link
                    href="/subscriptions"
                    onClick={(e) => {
                      if (!shouldInterceptClick(e)) return;
                      e.preventDefault();
                      onNavigate("/subscriptions");
                    }}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">Assinatura</span>
                    {planName === "Free" ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 leading-tight">
                        Grátis
                      </span>
                    ) : hasActivePlan === false ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 leading-tight">
                        Sem plano
                      </span>
                    ) : null}
                  </Link>
                );
              })()}
            </div>
          </>
        ) : null}
      </nav>

      <div className={`border-t p-4 space-y-4 ${compact ? "pb-6" : ""}`}>
        <div className="space-y-1 border-b pb-4">
          <p className="text-sm font-medium text-foreground truncate" title={userName || ""}>
            {userName || "Usuário"}
          </p>
          <p className="text-xs text-muted-foreground truncate" title={userEmail || ""}>
            {userEmail || ""}
          </p>
          {!isAdmin ? (
            <div className="flex items-center gap-2 mt-2 pt-2">
              <div
                className={`h-2 w-2 rounded-full ${whatsappStatus === "Conectado" ? "bg-green-500" : "bg-red-500"}`}
              />
              <span className="text-xs text-muted-foreground font-medium">WhatsApp {whatsappStatus}</span>
            </div>
          ) : null}
          {!isAdmin && creditBalance != null && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <Coins className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-medium text-amber-600">
                {creditBalance.toLocaleString("pt-BR")} créditos
              </span>
            </div>
          )}
        </div>

        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </>
  );
}

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { logout, user } = useAuthStore();
  const [whatsappStatus, setWhatsappStatus] = useState<string>("Desconectado");
  const [isWhatsappMenuOpen, setIsWhatsappMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [hasActivePlan, setHasActivePlan] = useState<boolean | null>(null);
  const [planFeatures, setPlanFeatures] = useState<Record<string, boolean> | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);
  const [subscriptionResolved, setSubscriptionResolved] = useState(false);
  const [settingsResolved, setSettingsResolved] = useState(false);
  const logoSrc = "/logo.png";

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchStatus = async () => {
      if (!user?.id || user.role === "ADMIN") return;
      try {
        const res = await api.get(`/whatsapp/status/${user.id}`);
        const normalized = normalizeWhatsappStatus(res.data?.status);
        setWhatsappStatus(normalized === "open" ? "Conectado" : "Desconectado");
      } catch (error) {
        setWhatsappStatus("Desconectado");
      }
    };

    if (user?.id && user.role !== "ADMIN") {
      fetchStatus();
      intervalId = setInterval(fetchStatus, 15000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user?.id, user?.role]);

  useEffect(() => {
    let cancelled = false;

    const fetchSubscription = async () => {
      if (!user?.id) {
        setHasActivePlan(null);
        setPlanFeatures(null);
        setPlanName(null);
        setSubscriptionResolved(false);
        return;
      }

      if (user.role === "ADMIN") {
        setSubscriptionResolved(true);
        return;
      }

      setSubscriptionResolved(false);
      try {
        const res = await api.get(`/subscriptions/user/${user.id}`);
        if (cancelled) return;
        setHasActivePlan(res.data?.status === 'active');
        setPlanFeatures(res.data?.plan?.features || null);
        setPlanName(res.data?.plan?.name || null);
      } catch {
        if (cancelled) return;
        setHasActivePlan(false);
        setPlanFeatures(null);
        setPlanName(null);
      } finally {
        if (!cancelled) {
          setSubscriptionResolved(true);
        }
      }
    };

    fetchSubscription();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchBalance = async () => {
      if (!user?.id || user.role === 'ADMIN') return;
      try {
        const res = await api.get(`/credits/balance/${user.id}`);
        setCreditBalance(res.data.balance);
      } catch {
        setCreditBalance(null);
      }
    };

    if (user?.id && user.role !== 'ADMIN') {
      fetchBalance();
      intervalId = setInterval(fetchBalance, 30000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user?.id]);
  const { admin_lessons_confirmation_enabled, fetch: fetchSettings } = useSettingsStore();

  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setSettingsResolved(false);
      return;
    }

    if (user.role === "ADMIN") {
      setSettingsResolved(true);
      return;
    }

    setSettingsResolved(false);
    fetchSettings(user.id).finally(() => {
      if (!cancelled) {
        setSettingsResolved(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role, fetchSettings]);

  const isAdmin = user?.role === "ADMIN";
  const dashboardHref = isAdmin ? "/billing" : "/dashboard";
  const dashboardLabel = isAdmin ? "Faturamento" : "Dashboard";
  const hasFeature = (f: string) => isAdmin || planFeatures?.[f] === true;
  const links = isAdmin
    ? [
        { href: "/billing", label: "Faturamento", icon: Wallet },
        { href: "/admin/users", label: "Usuários", icon: Users },
        { href: "/admin/credit-config", label: "Créditos", icon: Coins },
        { href: "/admin/affiliates", label: "Afiliados", icon: Link2 },
        { href: "/admin/accesses", label: "Acessos", icon: Activity },
      ]
    : [
        ...(planName === "Free" ? [{ href: "/welcome", label: "Home", icon: Home }] : []),
        ...(hasFeature("dashboard") ? [{ href: dashboardHref, label: dashboardLabel, icon: LayoutDashboard }] : []),
        { href: "/students", label: "Alunos", icon: Users },
        ...(admin_lessons_confirmation_enabled !== false && hasFeature("lesson_confirmation") ? [{ href: "/lessons", label: "Aulas", icon: CalendarDays }] : []),
        ...(hasFeature("content_studio") ? [{ href: "/content", label: "Conteúdo", icon: FileText }] : []),
        ...(hasFeature("automations") ? [{ href: "/automation", label: "Automação", icon: Bot }] : []),
        ...(hasActivePlan && hasFeature("affiliate_program") ? [{ href: "/affiliate", label: "Afiliados", icon: Link2 }] : []),
      ];
  const whatsappChildren = [
    { href: "/whatsapp", label: "Conexão" },
    { href: "/messages", label: "Mensagens" },
    { href: "/settings", label: "Configurações" },
  ];

  const isWhatsappSectionActive =
    pathname === "/whatsapp" ||
    pathname.startsWith("/whatsapp/") ||
    pathname === "/messages" ||
    pathname.startsWith("/messages/") ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/");

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isWhatsappSectionActive) {
      setIsWhatsappMenuOpen(true);
    }
  }, [isWhatsappSectionActive]);

  const shouldHoldTeacherSidebar = !isAdmin && (!subscriptionResolved || !settingsResolved);

  if (shouldHoldTeacherSidebar) {
    return <SidebarLoadingShell logoSrc={logoSrc} />;
  }

  const shouldInterceptClick = (event: React.MouseEvent) => {
    return (
      !event.defaultPrevented &&
      event.button === 0 &&
      !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
    );
  };

  const handleNavigate = (href: string) => {
    if (href === pathname) return;
    if (href !== "/admin/users" && pathname.startsWith(`${href}/`)) return;

    const ev = new CustomEvent("talkion:before-navigate", {
      detail: { href },
      cancelable: true,
    });
    window.dispatchEvent(ev);
    if (ev.defaultPrevented) return;

    const doPush = () => {
      const anyDocument = document as any;
      if (typeof anyDocument?.startViewTransition === "function") {
        anyDocument.startViewTransition(() => {
          router.push(href);
        });
        return;
      }
      router.push(href);
    };

    doPush();
  };

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b bg-background px-4 md:hidden">
        <div className="flex items-center gap-2">
          <Image
            src={logoSrc}
            alt="Talkion"
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 object-contain"
            unoptimized
          />
          <span className="text-lg font-semibold leading-none tracking-tight text-[#18181b]">
            Talkion
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r bg-background shadow-2xl">
            <SidebarNav
              compact
              isAdmin={isAdmin}
              logoSrc={logoSrc}
              links={links}
              whatsappChildren={whatsappChildren}
              pathname={pathname}
              isWhatsappSectionActive={isWhatsappSectionActive}
              isWhatsappMenuOpen={isWhatsappMenuOpen}
              onToggleWhatsappMenu={() => setIsWhatsappMenuOpen((current) => !current)}
              shouldInterceptClick={shouldInterceptClick}
              onNavigate={handleNavigate}
              onCloseMobile={() => setMobileOpen(false)}
              userName={user?.name || ""}
              userEmail={user?.email || ""}
              whatsappStatus={whatsappStatus}
              creditBalance={creditBalance}
              hasActivePlan={hasActivePlan}
              planName={planName}
              onLogout={logout}
            />
          </div>
        </div>
      ) : null}

      <div className="hidden w-64 shrink-0 md:block" aria-hidden="true" />
      <div className="fixed left-0 top-0 z-40 hidden h-[100dvh] w-64 flex-col border-r bg-muted/30 overflow-hidden md:flex">
        <SidebarNav
          isAdmin={isAdmin}
          logoSrc={logoSrc}
          links={links}
          whatsappChildren={whatsappChildren}
          pathname={pathname}
          isWhatsappSectionActive={isWhatsappSectionActive}
          isWhatsappMenuOpen={isWhatsappMenuOpen}
          hasActivePlan={hasActivePlan}
          planName={planName}
          onToggleWhatsappMenu={() => setIsWhatsappMenuOpen((current) => !current)}
          shouldInterceptClick={shouldInterceptClick}
          onNavigate={handleNavigate}
          onCloseMobile={() => setMobileOpen(false)}
          userName={user?.name || ""}
          userEmail={user?.email || ""}
          whatsappStatus={whatsappStatus}
          creditBalance={creditBalance}
          onLogout={logout}
        />
      </div>
    </>
  );
}

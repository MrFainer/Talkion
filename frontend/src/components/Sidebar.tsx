"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import api from "@/lib/api";
import {
  Users,
  LayoutDashboard,
  MessageCircle,
  Bot,
  LogOut,
  ShieldAlert,
  Settings2,
  ChevronDown,
  Link2,
} from "lucide-react";

const normalizeWhatsappStatus = (value: unknown) => {
  const raw = String(value || "").trim().toLowerCase();
  return ["open", "connected", "online"].includes(raw) ? "open" : raw;
};

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { logout, user } = useAuthStore();
  const [logoSrc, setLogoSrc] = useState("/logo.png");
  const [whatsappStatus, setWhatsappStatus] = useState<string>("Desconectado");
  const [isWhatsappMenuOpen, setIsWhatsappMenuOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    setLogoSrc(`/logo.png?v=${Date.now()}`);
  }, []);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchStatus = async () => {
      if (!user?.id) return;
      try {
        const res = await api.get(`/whatsapp/status/${user.id}`);
        const normalized = normalizeWhatsappStatus(res.data?.status);
        setWhatsappStatus(normalized === "open" ? "Conectado" : "Desconectado");
      } catch (error) {
        setWhatsappStatus("Desconectado");
      }
    };

    if (user?.id) {
      fetchStatus();
      intervalId = setInterval(fetchStatus, 15000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user?.id]);

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/students", label: "Alunos", icon: Users },
    { href: "/automation", label: "Automação", icon: Bot },
  ];
  const adminLink =
    user?.role === "ADMIN"
      ? { href: "/admin", label: "Admin", icon: ShieldAlert }
      : null;

  const whatsappChildren = [
    { href: "/whatsapp", label: "Conexão" },
    { href: "/settings", label: "Configurações" },
  ];

  const isWhatsappSectionActive =
    pathname === "/whatsapp" ||
    pathname.startsWith("/whatsapp/") ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/");

  useEffect(() => {
    if (isNavigating) {
      setIsNavigating(false);
    }
  }, [pathname, isNavigating]);

  useEffect(() => {
    if (isWhatsappSectionActive) {
      setIsWhatsappMenuOpen(true);
    }
  }, [isWhatsappSectionActive]);

  const shouldInterceptClick = (event: React.MouseEvent) => {
    return (
      !event.defaultPrevented &&
      event.button === 0 &&
      !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
    );
  };

  const handleNavigate = (href: string) => {
    if (href === pathname || pathname.startsWith(`${href}/`)) return;

    const leavingWhatsappSection =
      !(
        href === "/whatsapp" ||
        href.startsWith("/whatsapp/") ||
        href === "/settings" ||
        href.startsWith("/settings/")
      );

    if (leavingWhatsappSection && isWhatsappMenuOpen) {
      setIsWhatsappMenuOpen(false);
    }

    setIsNavigating(true);

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

    if (leavingWhatsappSection && isWhatsappMenuOpen) {
      window.setTimeout(doPush, 180);
      return;
    }

    doPush();
  };

  return (
    <div className="sticky top-0 flex h-full w-64 shrink-0 flex-col border-r bg-muted/30">
      <div
        className={`pointer-events-none fixed inset-0 z-40 bg-background transition-opacity duration-200 ${
          isNavigating ? "opacity-20" : "opacity-0"
        }`}
      />
      <div className="border-b px-6 py-5">
        <div className="flex items-center gap-2.5">
          <img
            src={logoSrc}
            alt="Talkion"
            className="h-8 w-8 shrink-0 object-contain"
          />
          <span className="text-2xl font-semibold leading-none tracking-tight text-[#18181b]">
            Talkion
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={(e) => {
                if (!shouldInterceptClick(e)) return;
                e.preventDefault();
                handleNavigate(link.href);
              }}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}

        <div className="pt-2">
          <button
            type="button"
            onClick={() => setIsWhatsappMenuOpen((current) => !current)}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isWhatsappSectionActive
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground"
            }`}
          >
            <MessageCircle className="h-4 w-4" />
            <span className="flex-1 text-left">WhatsApp</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${isWhatsappMenuOpen ? "rotate-180" : ""}`}
            />
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
                        handleNavigate(child.href);
                      }}
                      className={`flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                        isActive
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {child.href === "/settings" ? (
                        <Settings2 className="h-4 w-4" />
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

        {adminLink ? (
          (() => {
            const AdminIcon = adminLink.icon;
            const isActive = pathname === adminLink.href;
            return (
              <Link
                href={adminLink.href}
                onClick={(e) => {
                  if (!shouldInterceptClick(e)) return;
                  e.preventDefault();
                  handleNavigate(adminLink.href);
                }}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                }`}
              >
                <AdminIcon className="h-4 w-4" />
                {adminLink.label}
              </Link>
            );
          })()
        ) : null}
      </nav>

      <div className="p-4 border-t space-y-4">
        <div className="space-y-1 border-b pb-4">
          <p className="text-sm font-medium text-foreground truncate" title={user?.name || ""}>
            {user?.name || "Usuário"}
          </p>
          <p className="text-xs text-muted-foreground truncate" title={user?.email || ""}>
            {user?.email || ""}
          </p>
          <div className="flex items-center gap-2 mt-2 pt-2">
            <div
              className={`h-2 w-2 rounded-full ${
                whatsappStatus === "Conectado" ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-xs text-muted-foreground font-medium">
              WhatsApp {whatsappStatus}
            </span>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import api from "@/lib/api";
import { Users, LayoutDashboard, MessageCircle, LogOut, ShieldAlert, Settings2 } from "lucide-react";

const normalizeWhatsappStatus = (value: unknown) => {
  const raw = String(value || "").trim().toLowerCase();
  return ["open", "connected", "online"].includes(raw) ? "open" : raw;
};

export function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuthStore();
  const [logoSrc, setLogoSrc] = useState("/logo.png");
  const [whatsappStatus, setWhatsappStatus] = useState<string>("Desconectado");

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
    { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
    { href: "/settings", label: "Configurações", icon: Settings2 },
  ];

  if (user?.role === "ADMIN") {
    links.push({ href: "/admin", label: "Admin", icon: ShieldAlert });
  }

  return (
    <div className="sticky top-0 flex h-full w-64 shrink-0 flex-col border-r bg-muted/30">
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

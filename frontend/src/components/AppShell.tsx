"use client";

import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/Sidebar";

const PUBLIC_ROUTES = ["/", "/login"];

function ShellLoadingScreen() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <p className="text-sm text-muted-foreground">Carregando sua área...</p>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isHydrated, user } = useAuthStore();
  const hideSidebar = PUBLIC_ROUTES.some((route) =>
    route === "/" ? pathname === route : pathname.startsWith(route)
  );
  const isAdminShellPath =
    pathname === "/billing" || pathname === "/admin" || pathname.startsWith("/admin/");
  const shouldHoldSidebar =
    !isHydrated ||
    !user ||
    (user.role === "ADMIN" && !isAdminShellPath) ||
    (user.role !== "ADMIN" && isAdminShellPath);

  if (hideSidebar) {
    return <>{children}</>;
  }

  if (shouldHoldSidebar) {
    return <ShellLoadingScreen />;
  }

  return (
    <>
      <Sidebar />
      {children}
    </>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { Sidebar } from "@/components/Sidebar";

const PUBLIC_ROUTES = ["/", "/login"];

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
    return (
      <>
        <div className="fixed left-0 right-0 top-0 z-50 h-14 border-b bg-background md:hidden" />
        <div className="hidden w-64 shrink-0 md:block" aria-hidden="true" />
        <div
          className="fixed left-0 top-0 z-40 hidden h-[100dvh] w-64 border-r bg-muted/30 md:flex"
          aria-hidden="true"
        />
        {children}
      </>
    );
  }

  return (
    <>
      <Sidebar />
      {children}
    </>
  );
}

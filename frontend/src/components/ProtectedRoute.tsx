"use client";

import { useAuthStore } from "@/store/auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isHydrated, hydrate, user, subscriptionStatus, isFreePlan } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const adminAllowedRoutes = ["/billing", "/affiliate", "/admin"];
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  useEffect(() => {
    setMounted(true);
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) {
      document.cookie = `affiliate_ref=${encodeURIComponent(ref)}; path=/; max-age=86400; SameSite=Lax`;
    }
  }, [pathname]);

  const publicRoutes = ['/login', '/'];

  useEffect(() => {
    if (mounted && isHydrated && !isAuthenticated && !publicRoutes.includes(pathname)) {
      router.push("/login");
    }
  }, [isAuthenticated, isHydrated, router, pathname, mounted]);

  useEffect(() => {
    if (!mounted || !isHydrated || !isAuthenticated || user?.role !== "ADMIN") return;
    if (publicRoutes.includes(pathname)) return;

    const isAllowed = adminAllowedRoutes.some((route) =>
      pathname === route || pathname.startsWith(`${route}/`),
    );

    if (!isAllowed) {
      router.replace("/billing");
    }
  }, [mounted, isHydrated, isAuthenticated, pathname, router, user?.role]);

  useEffect(() => {
    if (!mounted || !isHydrated || !isAuthenticated || user?.role === "ADMIN") return;
    if (!isAdminRoute) return;

    const fallbackRoute =
      isFreePlan || subscriptionStatus === "none" ? "/welcome" : "/dashboard";
    router.replace(fallbackRoute);
  }, [
    isAdminRoute,
    isAuthenticated,
    isFreePlan,
    isHydrated,
    mounted,
    pathname,
    router,
    subscriptionStatus,
    user?.role,
  ]);

  if (!mounted || !isHydrated) {
    return null;
  }

  if (!isAuthenticated && !publicRoutes.includes(pathname)) {
    return null;
  }

  if (isAuthenticated && user?.role !== "ADMIN" && isAdminRoute) {
    return null;
  }

  return <>{children}</>;
}

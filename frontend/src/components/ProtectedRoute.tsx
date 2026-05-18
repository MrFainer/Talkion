"use client";

import { useAuthStore } from "@/store/auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isHydrated, hydrate } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (mounted && isHydrated && !isAuthenticated && pathname !== '/login') {
      router.push("/login");
    }
  }, [isAuthenticated, isHydrated, router, pathname, mounted]);

  if (!mounted || !isHydrated) {
    return null; // Aguarda a hidratação completa
  }

  if (!isAuthenticated && pathname !== '/login') {
    return null; // Não renderiza o conteúdo se não estiver autenticado
  }

  return <>{children}</>;
}

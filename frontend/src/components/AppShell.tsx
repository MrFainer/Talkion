"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

const PUBLIC_ROUTES = ["/", "/login"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = PUBLIC_ROUTES.some((route) =>
    route === "/" ? pathname === route : pathname.startsWith(route)
  );

  if (hideSidebar) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      {children}
    </>
  );
}

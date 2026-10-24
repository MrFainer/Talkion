"use client";

import { useEffect } from "react";
import { trackSiteVisit } from "@/lib/siteVisitTracking";
import LpHeader from "./LpHeader";
import LpHero from "./LpHero";
import LpProblema from "./LpProblema";
import LpComoFunciona from "./LpComoFunciona";
import LpRecursos from "./LpRecursos";
import LpPublico from "./LpPublico";
import LpPlanos from "./LpPlanos";
import LpProva from "./LpProva";
import LpFaq from "./LpFaq";
import LpFechamento from "./LpFechamento";

/**
 * LP de conversão (`/lp`), separada da home institucional (`/`).
 * O rastreio usa o mesmo tipo "HOME" — a rota é gravada em `path` pelo tracker.
 */
export default function LandingLp() {
  useEffect(() => {
    void trackSiteVisit("HOME");
  }, []);

  return (
    <div className="w-full flex-1 min-h-[100dvh] bg-background pb-20 md:pb-0">
      <LpHeader />
      <main>
        <LpHero />
        <LpProblema />
        <LpComoFunciona />
        <LpRecursos />
        <LpPublico />
        <LpPlanos />
        <LpProva />
        <LpFaq />
      </main>
      <LpFechamento />
    </div>
  );
}

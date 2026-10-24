"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";

const navegacao = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#recursos", label: "Recursos" },
  { href: "#planos", label: "Planos" },
  { href: "#duvidas", label: "Dúvidas" },
];

export default function LpHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Sobre o hero escuro o cabeçalho é claro; ao rolar, vira a barra branca.
  const sobreHero = !scrolled && !aberto;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-200 ${
        sobreHero ? "border-b border-transparent bg-transparent" : "border-b border-border bg-background/90 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5">
        <Link href="/lp" className="flex items-center gap-2" aria-label="Talkion — início">
          <Image
            src={sobreHero ? "/logo-branco.png" : "/logo.png"}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7"
            priority
          />
          <span
            className={`text-lg font-semibold tracking-tight ${sobreHero ? "text-background" : "text-foreground"}`}
          >
            Talkion
          </span>
        </Link>

        <nav className="hidden flex-1 items-center gap-7 md:flex" aria-label="Seções da página">
          {navegacao.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition-colors ${
                sobreHero
                  ? "text-background/70 hover:text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link
            href="/login"
            className={`hidden rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:block ${
              sobreHero
                ? "text-background/80 hover:text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Entrar
          </Link>
          <Link
            href="/login?register=true&plan=Free"
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 ${
              sobreHero
                ? "bg-background text-foreground"
                : "bg-primary text-primary-foreground"
            }`}
          >
            Começar grátis
            <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border md:hidden ${
              sobreHero
                ? "border-background/30 text-background"
                : "border-border text-foreground"
            }`}
            aria-expanded={aberto}
            aria-controls="menu-lp"
            aria-label={aberto ? "Fechar menu" : "Abrir menu"}
          >
            {aberto ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {aberto && (
        <div id="menu-lp" className="border-t border-border bg-background px-5 py-3 md:hidden">
          <nav className="flex flex-col" aria-label="Seções da página (celular)">
            {navegacao.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setAberto(false)}
                className="border-b border-border/60 py-2.5 text-sm font-medium text-foreground last:border-0"
              >
                {item.label}
              </a>
            ))}
            <Link href="/login" className="py-2.5 text-sm font-medium text-muted-foreground">
              Entrar
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

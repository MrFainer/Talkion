import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { planos } from "./data";

export default function LpPlanos() {
  return (
    <section id="planos" className="scroll-mt-16 bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <span className="h-1 w-6 rounded-full bg-brand" />
            Planos
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Comece de graça. Cresça quando a turma crescer.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Todos os planos têm as mesmas funcionalidades. O que muda é a quantidade de alunos, de créditos de
            IA e de professores.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {planos.map((plano) => (
            <div
              key={plano.nome}
              className={`relative flex flex-col rounded-2xl border bg-card p-6 ${
                plano.destaque
                  ? "border-brand ring-1 ring-brand shadow-lg shadow-brand/10"
                  : "border-border"
              }`}
            >
              {plano.destaque && (
                <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-brand px-3 py-1 text-[11px] font-semibold text-brand-foreground">
                  <Sparkles className="h-3 w-3" />
                  Mais popular
                </span>
              )}

              <h3 className="text-lg font-semibold text-card-foreground">{plano.nome}</h3>
              <p className="mt-1 min-h-[40px] text-sm leading-snug text-muted-foreground">{plano.resumo}</p>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight text-card-foreground">{plano.preco}</span>
                {plano.periodo && (
                  <span className="text-sm text-muted-foreground">{plano.periodo}</span>
                )}
              </div>

              <span className="mt-3 inline-flex w-fit rounded-full bg-brand-muted px-2.5 py-1 text-xs font-medium text-foreground">
                {plano.creditos}
              </span>

              <ul className="mt-5 flex-1 space-y-2">
                {plano.recursos.map((recurso) => (
                  <li key={recurso} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                    <span>{recurso}</span>
                  </li>
                ))}
              </ul>

              {plano.alunoAdicional && (
                <p className="mt-4 text-[11px] text-muted-foreground">{plano.alunoAdicional}</p>
              )}

              <Link
                href={plano.href}
                className={`mt-4 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 ${
                  plano.destaque
                    ? "bg-brand text-brand-foreground"
                    : "border border-border bg-background text-foreground"
                }`}
              >
                {plano.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 px-6 py-5 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Precisa de mais de 250 alunos, professores ilimitados ou API? O plano Enterprise é sob consulta.
          </p>
          <a
            href="/#contact"
            className="shrink-0 text-sm font-semibold text-foreground underline decoration-brand decoration-2 underline-offset-4"
          >
            Solicitar proposta
          </a>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Quer ver a tabela comparativa completa?{" "}
          <a href="/#plans" className="font-medium text-foreground underline underline-offset-4">
            Comparar todos os planos
          </a>
          .
        </p>
      </div>
    </section>
  );
}

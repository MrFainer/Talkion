import { Quote, Star } from "lucide-react";
import { depoimentos } from "./data";

export default function LpProva() {
  return (
    <section className="border-y border-border bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <span className="h-1 w-6 rounded-full bg-brand" />
            Quem já usa
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Menos material para preparar, mais aula de verdade
          </h2>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {depoimentos.map((depoimento) => (
            <figure
              key={depoimento.autor}
              className="flex flex-col rounded-2xl border border-border bg-card p-6"
            >
              <Quote className="h-6 w-6 text-muted-foreground/40" />
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-card-foreground">
                “{depoimento.texto}”
              </blockquote>
              <div className="mt-5 flex items-center gap-1" aria-label="5 de 5 estrelas">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-foreground text-foreground" />
                ))}
              </div>
              <figcaption className="mt-3 text-xs font-medium text-muted-foreground">
                {depoimento.autor}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

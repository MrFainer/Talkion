"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { faq } from "./data";

export default function LpFaq() {
  const [aberta, setAberta] = useState<number | null>(0);

  return (
    <section id="duvidas" className="scroll-mt-16 bg-background py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <span className="h-1 w-6 rounded-full bg-brand" />
            Dúvidas
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Antes de você criar a conta
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Se ficar alguma dúvida, fale com a gente pelo formulário da página principal — respondemos por
            e-mail.
          </p>
          <a
            href="/#contact"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-foreground underline decoration-brand decoration-2 underline-offset-4"
          >
            Falar com o time
          </a>
        </div>

        <div className="divide-y divide-border border-y border-border">
          {faq.map((item, indice) => {
            const aberto = aberta === indice;
            return (
              <div key={item.pergunta}>
                <button
                  type="button"
                  onClick={() => setAberta(aberto ? null : indice)}
                  aria-expanded={aberto}
                  aria-controls={`resposta-${indice}`}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="text-base font-medium text-foreground">{item.pergunta}</span>
                  <Plus
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                      aberto ? "rotate-45" : ""
                    }`}
                  />
                </button>
                {aberto && (
                  <p id={`resposta-${indice}`} className="pb-5 pr-8 text-sm leading-relaxed text-muted-foreground">
                    {item.resposta}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

import { passos } from "./data";

export default function LpComoFunciona() {
  return (
    <section id="como-funciona" className="scroll-mt-16 border-y border-border bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <span className="h-1 w-6 rounded-full bg-brand" />
            Como funciona
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Do cadastro ao primeiro áudio corrigido no mesmo dia
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Quatro passos. Depois deles, a rotina diária do aluno roda sozinha — inclusive nos fins de semana.
          </p>
        </div>

        <ol className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {passos.map((passo, indice) => (
            <li key={passo.titulo} className="relative rounded-2xl border border-border bg-card p-6">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-sm font-semibold text-background">
                {String(indice + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-4 text-base font-semibold text-card-foreground">{passo.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{passo.texto}</p>
              {indice < passos.length - 1 && (
                <span
                  aria-hidden
                  className="absolute -right-3 top-1/2 hidden h-px w-6 bg-border lg:block"
                />
              )}
            </li>
          ))}
        </ol>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          O gabarito do quiz chega no ciclo seguinte, para o aluno revisar o que errou antes da próxima notícia.
        </p>
      </div>
    </section>
  );
}

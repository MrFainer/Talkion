import { dores } from "./data";

export default function LpProblema() {
  return (
    <section className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <span className="h-1 w-6 rounded-full bg-brand" />
            O problema
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            O aluno só pratica na aula. E a aula é uma vez por semana.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Entre uma aula e outra passam seis dias. É nesse intervalo que o conteúdo se perde — e é aí que
            você acaba virando produtor de material.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {dores.map((dor) => (
            <div
              key={dor.titulo}
              className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-foreground/20"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted/50 text-foreground">
                <dor.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-card-foreground">{dor.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{dor.texto}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start gap-4 rounded-2xl bg-foreground px-6 py-7 text-background sm:flex-row sm:items-center sm:justify-between">
          <p className="text-lg font-medium text-balance">
            O Talkion assume a rotina diária. Você continua sendo o professor.
          </p>
          <a
            href="#como-funciona"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition-opacity hover:opacity-90"
          >
            Ver como funciona
          </a>
        </div>
      </div>
    </section>
  );
}

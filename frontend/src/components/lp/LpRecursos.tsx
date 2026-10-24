import { recursos } from "./data";

export default function LpRecursos() {
  return (
    <section id="recursos" className="scroll-mt-16 bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <span className="h-1 w-6 rounded-full bg-brand" />
            Recursos
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Tudo que a rotina de estudo precisa — já pronto
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Conteúdo, correção e acompanhamento no mesmo lugar. Você não monta nada à mão.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {recursos.map((recurso) => (
            <div key={recurso.titulo} className="bg-card p-7">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-muted text-foreground">
                <recurso.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-card-foreground">{recurso.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{recurso.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

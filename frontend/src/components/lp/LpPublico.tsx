import { publico } from "./data";

export default function LpPublico() {
  return (
    <section className="bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <span className="h-1 w-6 rounded-full bg-brand" />
              Para quem é
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
              Feito para quem ensina — sozinho ou com equipe
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Se você já manda mensagem no WhatsApp para os seus alunos, o Talkion só organiza e automatiza o
              que você já faz.
            </p>
          </div>

          <div className="space-y-4">
            {publico.map((item) => (
              <div
                key={item.titulo}
                className="flex gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-foreground/20"
              >
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
                  <item.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-card-foreground">{item.titulo}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

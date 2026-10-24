import { Check, CheckCheck, Mic, Play } from "lucide-react";

/**
 * Mockup da conversa no WhatsApp: notícia do dia → quiz → áudio → feedback.
 * Só tokens do design system (nenhuma cor crua); é ilustrativo, sem dado real.
 */

function Barra({ altura }: { altura: number }) {
  return (
    <span
      className="w-[3px] rounded-full bg-current opacity-70"
      style={{ height: `${altura}px` }}
    />
  );
}

export default function WhatsAppChat() {
  return (
    <div className="relative mx-auto w-full max-w-[360px]">
      {/* brilho de fundo */}
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[3rem] bg-brand/20 blur-3xl"
      />

      <div className="overflow-hidden rounded-[2rem] border border-border bg-background shadow-2xl">
        {/* barra da conversa */}
        <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
            T
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-card-foreground">Talkion · Inglês B1</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              online
            </p>
          </div>
          <span className="rounded-full bg-brand-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
            grupo
          </span>
        </div>

        {/* conversa */}
        <div className="space-y-2.5 bg-muted/40 px-3 py-4">
          <div className="flex justify-center">
            <span className="rounded-full bg-card px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm">
              Hoje, 07:00
            </span>
          </div>

          {/* notícia */}
          <div className="max-w-[92%] rounded-xl rounded-tl-sm border border-border bg-card p-3 shadow-sm">
            <p className="text-[13px] font-semibold text-card-foreground">Good morning!</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Today&apos;s news: scientists found a new frog species in the Amazon.
            </p>
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/60 px-2 py-1.5">
              <Play className="h-3 w-3 text-foreground" />
              <span className="text-[11px] font-medium text-foreground">Level B1 · 2 min</span>
            </div>
            <p className="mt-1.5 text-right text-[10px] text-muted-foreground">
              07:00 <CheckCheck className="mb-0.5 ml-0.5 inline h-3 w-3" />
            </p>
          </div>

          {/* quiz */}
          <div className="max-w-[92%] rounded-xl rounded-tl-sm border border-border bg-card p-3 shadow-sm">
            <p className="text-[13px] font-medium text-card-foreground">
              1) What did the scientists find?
            </p>
            <ul className="mt-2 space-y-1 text-[13px] text-muted-foreground">
              <li>a) A new bird</li>
              <li className="rounded-md bg-brand-muted px-1.5 py-0.5 font-medium text-foreground">
                b) A new frog
              </li>
              <li>c) A new tree</li>
            </ul>
          </div>

          {/* resposta do aluno (áudio) */}
          <div className="ml-auto max-w-[80%] rounded-xl rounded-tr-sm bg-brand-muted p-2.5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-brand-foreground">
                <Mic className="h-3.5 w-3.5" />
              </span>
              <span className="flex flex-1 items-end gap-[2px] text-foreground">
                {[8, 14, 10, 18, 12, 20, 9, 15, 11, 17, 7, 13].map((h, i) => (
                  <Barra key={i} altura={h} />
                ))}
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground">0:12</span>
            </div>
            <p className="mt-1 text-right text-[10px] text-muted-foreground">
              07:04 <Check className="mb-0.5 ml-0.5 inline h-3 w-3" />
            </p>
          </div>

          {/* feedback da IA */}
          <div className="max-w-[92%] rounded-xl rounded-tl-sm border border-border bg-card p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-card-foreground">Speaking · muito bom!</p>
              <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-brand-foreground">
                8/10
              </span>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Fluência ótima. Atenção ao som de <span className="font-medium text-foreground">“th”</span> em
              <span className="font-medium text-foreground"> “the”</span> — treine devagar.
            </p>
          </div>
        </div>

        {/* barra de mensagem */}
        <div className="flex items-center gap-2 border-t border-border bg-card px-3 py-2.5">
          <div className="flex-1 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-[12px] text-muted-foreground">
            Mensagem
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-brand-foreground">
            <Mic className="h-4 w-4" />
          </span>
        </div>
      </div>
    </div>
  );
}

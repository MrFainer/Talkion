import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, MessageCircle, Play } from "lucide-react";
import WhatsAppChat from "./WhatsAppChat";
import { idiomas, numeros } from "./data";

export default function LpHero() {
  return (
    <section className="relative overflow-hidden bg-foreground text-background">
      {/* brilhos de fundo */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 right-[-10%] h-[420px] w-[420px] rounded-full bg-brand/25 blur-[120px]" />
        <div className="absolute bottom-[-30%] left-[-10%] h-[380px] w-[380px] rounded-full bg-background/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-28 lg:pb-24 lg:pt-36">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-background/15 bg-background/5 px-3 py-1.5 text-xs font-medium text-background/80">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
              </span>
              Aprendizado diário no WhatsApp
            </span>

            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Seus alunos praticam <span className="text-brand">todo dia</span>.
              <br className="hidden sm:block" /> Você não prepara nada.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-background/70">
              O Talkion envia a notícia do dia, aplica o quiz e corrige o speaking pelo WhatsApp — no nível de
              cada aluno. Sua aula semanal vira rotina diária, sem trabalho manual para você.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/login?register=true&plan=Free"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-base font-semibold text-brand-foreground transition-transform hover:-translate-y-0.5"
              >
                Começar grátis
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-background/20 px-6 py-3.5 text-base font-medium text-background transition-colors hover:bg-background/10"
              >
                <Play className="h-4 w-4" />
                Ver como funciona
              </a>
            </div>

            <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-background/60">
              {["Sem cartão de crédito", "2.000 créditos grátis", "Até 3 alunos"].map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-brand" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-10 flex items-center gap-4 border-t border-background/10 pt-6">
              <div className="flex items-center gap-1.5">
                {idiomas.slice(0, 5).map((idioma) => (
                  <Image
                    key={idioma.code}
                    src={`/flags/${idioma.code}.svg`}
                    alt={idioma.nome}
                    width={22}
                    height={22}
                    className="h-[22px] w-[22px] rounded-full ring-1 ring-background/20"
                  />
                ))}
                <span className="ml-1 text-xs text-background/50">+3 idiomas</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-background/60">
                <MessageCircle className="h-3.5 w-3.5 text-brand" />
                O aluno não instala nada
              </div>
            </div>
          </div>

          <div className="lg:pl-4">
            <WhatsAppChat />
          </div>
        </div>
      </div>

      {/* faixa de números */}
      <div className="relative border-t border-background/10 bg-background/5">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-y-8 px-5 py-8 sm:grid-cols-4">
          {numeros.map((numero) => (
            <div key={numero.rotulo} className="text-center">
              <div className="text-2xl font-semibold tracking-tight text-background sm:text-3xl">
                {numero.valor}
              </div>
              <div className="mt-1 text-xs text-background/60 sm:text-sm">{numero.rotulo}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

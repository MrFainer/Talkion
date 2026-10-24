import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function LpFechamento() {
  return (
    <>
      {/* CTA final */}
      <section className="bg-background px-5 pb-20 sm:pb-28">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-foreground px-6 py-14 text-center text-background sm:px-12 sm:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand/25 blur-[100px]"
          />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Coloque sua turma praticando ainda esta semana
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-background/70">
              Crie a conta, cadastre até 3 alunos e veja a primeira conversa acontecer no WhatsApp. Sem cartão de
              crédito.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/login?register=true&plan=Free"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 text-base font-semibold text-brand-foreground transition-transform hover:-translate-y-0.5"
              >
                Começar grátis
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="/#contact"
                className="inline-flex items-center justify-center rounded-xl border border-background/20 px-6 py-3.5 text-base font-medium text-background transition-colors hover:bg-background/10"
              >
                Falar com especialista
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* rodapé */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="" width={26} height={26} className="h-[26px] w-[26px]" />
              <span className="text-base font-semibold tracking-tight text-foreground">Talkion</span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Aprendizado diário de idiomas no WhatsApp, para professores que querem ensinar em vez de produzir
              material.
            </p>
          </div>

          <nav aria-label="Produto">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Produto</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href="#como-funciona" className="text-foreground/80 transition-colors hover:text-foreground">
                  Como funciona
                </a>
              </li>
              <li>
                <a href="#recursos" className="text-foreground/80 transition-colors hover:text-foreground">
                  Recursos
                </a>
              </li>
              <li>
                <a href="#planos" className="text-foreground/80 transition-colors hover:text-foreground">
                  Planos
                </a>
              </li>
              <li>
                <a href="#duvidas" className="text-foreground/80 transition-colors hover:text-foreground">
                  Dúvidas
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-label="Conta">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Conta</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/login" className="text-foreground/80 transition-colors hover:text-foreground">
                  Entrar
                </Link>
              </li>
              <li>
                <Link
                  href="/login?register=true&plan=Free"
                  className="text-foreground/80 transition-colors hover:text-foreground"
                >
                  Criar conta grátis
                </Link>
              </li>
              <li>
                <Link href="/" className="text-foreground/80 transition-colors hover:text-foreground">
                  Página inicial
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Contato">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Contato</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href="/#contact" className="text-foreground/80 transition-colors hover:text-foreground">
                  Falar com o time
                </a>
              </li>
              <li>
                <a href="/#plans" className="text-foreground/80 transition-colors hover:text-foreground">
                  Planos para escolas
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-5 text-xs text-muted-foreground sm:flex-row">
            <p>© {new Date().getFullYear()} Talkion. Todos os direitos reservados.</p>
            <p>Feito para professores de idiomas.</p>
          </div>
        </div>
      </footer>

      {/* CTA fixo no celular */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-5 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Grátis para começar</p>
            <p className="text-xs text-muted-foreground">2.000 créditos · até 3 alunos</p>
          </div>
          <Link
            href="/login?register=true&plan=Free"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Criar conta
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </>
  );
}

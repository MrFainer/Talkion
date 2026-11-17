import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { LEGAL, temDadosDaEmpresa } from "@/lib/legal";

/**
 * Casca das páginas legais (`/termos`, `/privacidade`).
 * Server component: o texto precisa estar no HTML entregue, sem depender de JS.
 */
export default function LegalLayout({
  titulo,
  resumo,
  children,
}: {
  titulo: string;
  resumo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] w-full bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Image src="/logo.png" alt="" width={24} height={24} className="h-6 w-6" />
            {LEGAL.marca}
          </Link>
          <Link
            href="/lp"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{titulo}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Última atualização: {LEGAL.atualizadoEm}</p>
        <p className="mt-6 text-base leading-relaxed text-foreground/80">{resumo}</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground/80 [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </div>

        <div className="mt-12 rounded-xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
          <p>
            Dúvidas sobre este documento:{" "}
            <a href={LEGAL.contatoUrl}>fale com o nosso time</a>
            {LEGAL.emailPrivacidade ? (
              <>
                {" "}
                ou escreva para <a href={`mailto:${LEGAL.emailPrivacidade}`}>{LEGAL.emailPrivacidade}</a>
              </>
            ) : null}
            .
          </p>
          {temDadosDaEmpresa ? (
            <p className="mt-2">
              {LEGAL.razaoSocial}
              {LEGAL.cnpj ? ` · CNPJ ${LEGAL.cnpj}` : ""}
            </p>
          ) : null}
        </div>

        <nav aria-label="Documentos legais" className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/termos" className="text-muted-foreground underline-offset-4 hover:underline">
            Termos de Uso
          </Link>
          <Link href="/privacidade" className="text-muted-foreground underline-offset-4 hover:underline">
            Política de Privacidade
          </Link>
          <Link href="/lp" className="text-muted-foreground underline-offset-4 hover:underline">
            Página do Talkion
          </Link>
        </nav>
      </main>
    </div>
  );
}

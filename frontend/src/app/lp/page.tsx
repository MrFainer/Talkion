import type { Metadata } from "next";
import LandingLp from "@/components/lp/LandingLp";

export const metadata: Metadata = {
  title: "Talkion — seus alunos praticam todo dia no WhatsApp",
  description:
    "O Talkion envia a notícia do dia, aplica o quiz e corrige o speaking pelo WhatsApp, no nível de cada aluno. Sua aula semanal vira rotina diária, sem trabalho manual.",
  alternates: { canonical: "/lp" },
  openGraph: {
    title: "Talkion — seus alunos praticam todo dia no WhatsApp",
    description:
      "Notícia real, quiz e speaking corrigido por IA no WhatsApp do aluno. Automático e no nível de cada um.",
    type: "website",
    locale: "pt_BR",
  },
  robots: { index: true, follow: true },
};

export default function LpPage() {
  return <LandingLp />;
}

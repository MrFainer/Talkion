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
    url: "/lp",
    siteName: "Talkion",
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: "/lp-og.png",
        width: 1200,
        height: 630,
        alt: "Talkion: seus alunos praticam todo dia no WhatsApp, você não prepara nada.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Talkion — seus alunos praticam todo dia no WhatsApp",
    description:
      "Notícia real, quiz e speaking corrigido por IA no WhatsApp do aluno. Automático e no nível de cada um.",
    images: ["/lp-og.png"],
  },
  robots: { index: true, follow: true },
};

export default function LpPage() {
  return <LandingLp />;
}

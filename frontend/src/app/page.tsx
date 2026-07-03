"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { trackSiteVisit } from "@/lib/siteVisitTracking";
import {
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  Globe,
  GraduationCap,
  LayoutDashboard,
  MessageCircle,
  Mic,
  Newspaper,
  Sparkles,
  Users,
  Zap,
  Star,
  BarChart3,
  CreditCard,
  Settings,
  BookOpen,
  Bot,
  Mail,
  Quote,
  Clock,
  Smartphone,
  Repeat,
  Award,
  CalendarCheck,
  HelpCircle,
  TrendingUp,
  Building2,
} from "lucide-react";

const features = [
  {
    icon: Newspaper,
    title: "Conteúdo Automático Diário",
    desc: "Seus alunos recebem notícias reais adaptadas ao nível deles todos os dias. Sem você precisar criar ou buscar conteúdo manualmente.",
  },
  {
    icon: Mic,
    title: "Speaking com IA",
    desc: "O aluno grava áudio respondendo sobre o conteúdo. A IA transcreve e avalia pronúncia e fluência automaticamente.",
  },
  {
    icon: BookOpen,
    title: "Quiz Inteligente",
    desc: "Perguntas de múltipla escolha geradas por IA automaticamente. Correção no dia seguinte para reforçar o aprendizado.",
  },
  {
    icon: MessageCircle,
    title: "Fluxo Privado e em Grupo",
    desc: "Modo privado para prática individual de speaking. Modo grupo para leitura e quiz coletivo. Um bot para cada necessidade.",
  },
  {
    icon: Bot,
    title: "Geração Automática de Conteúdo",
    desc: "Scraping de notícias reais com fallback inteligente via IA. Conteúdo novo todos os dias sem trabalho manual.",
  },
  {
    icon: Users,
    title: "Gestão de Alunos",
    desc: "Cadastro completo de alunos, organização por turmas e atribuição de nível de proficiência. Tudo centralizado e fácil de gerenciar.",
  },
  {
    icon: BarChart3,
    title: "Dashboard do Professor",
    desc: "Métricas de engajamento, taxa de resposta diária, dias consecutivos de prática, evolução e ranking semanal da turma.",
  },
  {
    icon: Settings,
    title: "Mensagens Personalizáveis",
    desc: "Todas as mensagens do bot são customizáveis com variáveis como {{nome}}, {{telefone}}, {{data}}. Cada professor ajusta ao seu estilo.",
  },
  {
    icon: CreditCard,
    title: "Planos e Créditos",
    desc: "Planos de assinatura flexíveis com o modelo ideal para sua realidade. Pacotes de créditos e controle total de custos.",
  },
  {
    icon: Clock,
    title: "Automação Inteligente",
    desc: "Agendamento de envios, horários configuráveis e dias da semana personalizados por turma. O conteúdo chega no momento certo para cada aluno.",
  },
  {
    icon: GraduationCap,
    title: "Multinível",
    desc: "Suporte a múltiplos níveis de proficiência. Cada aluno recebe conteúdo adequado ao seu nível atual de conhecimento.",
  },
  {
    icon: CalendarCheck,
    title: "Confirmação de Aulas",
    desc: "Envio automático de confirmação de aulas pelo WhatsApp. Seus alunos confirmam presença com um simples sim ou não.",
  },
];

const steps = [
  {
    number: "01",
    title: "Configure seu bot",
    desc: "Conecte seu WhatsApp em segundos, cadastre seus alunos e personalize as mensagens do seu jeito.",
  },
  {
    number: "02",
    title: "Conteúdo gerado automaticamente",
    desc: "O sistema busca notícias reais, adapta ao nível dos seus alunos e envia tudo no horário que você programar.",
  },
  {
    number: "03",
    title: "Alunos praticam pelo WhatsApp",
    desc: "Eles recebem o conteúdo, respondem quizzes e gravam áudios de speaking. Tudo sem sair do aplicativo.",
  },
  {
    number: "04",
    title: "Você acompanha os resultados",
    desc: "O dashboard mostra engajamento, evolução, dias de prática e muito mais. Você sabe exatamente como cada aluno está.",
  },
];

const benefits = [
  {
    icon: Smartphone,
    title: "Seus alunos já estão no WhatsApp",
    desc: "Zero atrito de adoção. Você leva o aprendizado para o canal mais usado do mundo.",
  },
  {
    icon: Clock,
    title: "Economia de horas por semana",
    desc: "O Talkion cria conteúdo, corrige exercícios, avalia speaking e envia tudo automaticamente. Você foca no que importa.",
  },
  {
    icon: Repeat,
    title: "Rotina consistente todos os dias",
    desc: "Enquanto você dorme, seus alunos estão estudando. A automação garante prática diária sem depender de lembretes manuais.",
  },
  {
    icon: Award,
    title: "Resultados mensuráveis",
    desc: "Acompanhe a evolução real de cada aluno com dados concretos: dias de prática, notas de speaking, acertos nos quizzes.",
  },
];

const languages = [
  { name: "Inglês", flag: "GB" },
  { name: "Português", flag: "BR" },
  { name: "Espanhol", flag: "ES" },
  { name: "Francês", flag: "FR" },
  { name: "Alemão", flag: "DE" },
  { name: "Italiano", flag: "IT" },
  { name: "Japonês", flag: "JP" },
  { name: "Mandarim", flag: "CN" },
] as const;
const flagSrc = (code: string) => `/flags/${code.toLowerCase()}.svg`;

const depoimentos = [
  {
    texto: "Antes eu passava horas criando material e corrigindo exercícios. Hoje meus alunos praticam todo dia pelo WhatsApp enquanto eu foco no que realmente importa: dar aulas.",
    autor: "Professora de inglês — SP",
    estrelas: 5,
  },
  {
    texto: "O engajamento dos meus alunos disparou depois que comecei a usar o Talkion. Eles praticam todo dia e eu vejo a evolução pelo dashboard.",
    autor: "Professor de espanhol — RJ",
    estrelas: 5,
  },
  {
    texto: "Consegui escalar minhas turmas sem aumentar minha carga horária. O Talkion cuida da rotina de estudos enquanto eu dou atenção a cada aluno.",
    autor: "Escola de idiomas — MG",
    estrelas: 5,
  },
  {
    texto: "Meus alunos amam receber as notícias e fazer os quizzes no WhatsApp. Até quem tinha vergonha de falar inglês já está gravando áudios.",
    autor: "Professora de inglês — RS",
    estrelas: 5,
  },
];

const faq = [
  {
    question: "Todos os planos possuem as mesmas funcionalidades?",
    answer:
      "Sim! Todos os planos têm acesso às mesmas funcionalidades da plataforma. A diferença está na quantidade de alunos, créditos de IA e professores que você pode gerenciar.",
  },
  {
    question: "O plano gratuito tem limite de tempo?",
    answer:
      "Não! O plano Free é totalmente gratuito por tempo ilimitado. Você pode usar para sempre sem pagar nada, com 5.000 créditos mensais e até 10 alunos.",
  },
  {
    question: "Os créditos acumulam?",
    answer:
      "Créditos do plano são resetados todo mês na renovação. Já os créditos extras comprados à parte nunca expiram e se acumulam com os créditos do seu plano.",
  },
  {
    question: "Posso comprar mais créditos?",
    answer:
      "Sim! Oferecemos pacotes de créditos extras a partir de R$ 39,90. Basta acessar a página de assinatura e escolher o pacote desejado.",
  },
  {
    question: "Posso mudar de plano?",
    answer:
      "Sim! Você pode fazer upgrade ou downgrade quando quiser. O valor é recalculado proporcionalmente aos dias restantes do ciclo de faturamento.",
  },
  {
    question: "Como funciona o suporte?",
    answer:
      "Todos os planos têm suporte por e-mail. Planos pagos contam com suporte online e o School tem suporte dedicado com onboarding personalizado.",
  },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [depoimentoIndex, setDepoimentoIndex] = useState(0);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState("");
  const [contactMessage, setContactMessage] = useState("Quero saber mais informações sobre o Talkion");
  const [showContactHint, setShowContactHint] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    void trackSiteVisit("HOME");
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 50);
      setShowTop(window.scrollY > 400);
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setDepoimentoIndex((prev) => (prev + 1) % depoimentos.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const el = turnstileRef.current;
    if (!el) return;

    const renderWidget = () => {
      if (!(window as any).turnstile || el.dataset.turnstileRendered) return;
      el.dataset.turnstileRendered = "1";
      (window as any).turnstile.render(el, {
        sitekey:
          process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
          "1x00000000000000000000AA",
        theme: "dark",
      });
    };

    if ((window as any).turnstile) {
      renderWidget();
    } else if (!document.querySelector('script[src*="turnstile/v0/api.js"]')) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      script.onload = renderWidget;
      document.head.appendChild(script);
    }
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToContact = (plan: string) => {
    setContactMessage(`Quero saber mais informações sobre o Plano ${plan} do Talkion`);
    setShowContactHint(true);
    setTimeout(() => {
      document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  return (
    <div className="min-h-[100dvh] w-full [overscroll-behavior-y:contain]">
      {/* Navbar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/80 backdrop-blur-lg shadow-sm border-b border-slate-200/60"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className={`flex items-center gap-2.5 rounded-full px-3.5 py-1.5 transition-colors duration-300 ${scrolled ? "bg-white text-slate-900" : "bg-slate-950 text-white ring-1 ring-slate-800"}`}>
            <Image
              src={scrolled ? "/logo.png" : "/logo-branco.png"}
              alt="Talkion"
              width={22}
              height={22}
              className="h-5 w-5 shrink-0 object-contain"
            />
            <span className="text-lg font-semibold tracking-tight">
              Talkion
            </span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            {[
              { label: "Por que usar?", target: "benefits" },
              { label: "Como funciona", target: "how-it-works" },
              { label: "Funcionalidades", target: "features" },
              { label: "Idiomas", target: "languages" },
              { label: "Planos", target: "plans" },
              { label: "Contato", target: "contact" },
            ].map((item) => (
              <button
                key={item.target}
                onClick={() => scrollTo(item.target)}
                className={`text-sm font-medium transition hover:text-blue-500 ${
                  scrolled ? "text-slate-600" : "text-slate-300"
                }`}
              >
                {item.label}
              </button>
            ))}
            <Link
              href="/login"
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500"
            >
              Acessar Plataforma
            </Link>
          </div>
          <Link
            href="/login"
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition md:hidden ${
              scrolled
                ? "bg-blue-600 text-white"
                : "bg-white/10 text-white backdrop-blur"
            }`}
          >
            Entrar
          </Link>
        </div>
      </nav>

      {/* Hero - Foco na dor do professor */}
      <section className="relative min-h-[100dvh] flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.25),transparent_40%),radial-gradient(circle_at_70%_80%,rgba(99,102,241,0.15),transparent_35%),linear-gradient(180deg,#09090b_0%,#111827_45%,#0f172a_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:52px_52px] opacity-30" />
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_18%_22%,rgba(96,165,250,0.18)_0,transparent_28%),radial-gradient(circle_at_80%_30%,rgba(148,163,184,0.15)_0,transparent_24%),radial-gradient(circle_at_72%_76%,rgba(59,130,246,0.16)_0,transparent_28%)]" />
        <div className="absolute left-[6%] top-[22%] anim-float-slow max-md:hidden">
          <div className="h-12 w-12 rotate-12 rounded-xl border border-blue-500/25 bg-blue-500/5 backdrop-blur-sm" />
        </div>
        <div className="absolute right-[8%] top-[65%] anim-float-med max-md:hidden">
          <div className="h-10 w-10 -rotate-6 rounded-lg border border-indigo-500/25 bg-indigo-500/5 backdrop-blur-sm" />
        </div>
        <div className="absolute left-[12%] top-[15%] h-2.5 w-2.5 anim-glow rounded-full bg-blue-400 max-md:hidden" />
        <div className="absolute right-[18%] top-[20%] h-3 w-3 anim-drift rounded-full bg-indigo-400/70 max-md:hidden" />
        <div className="absolute left-[20%] bottom-[22%] anim-float-fast max-md:hidden">
          <div className="h-4 w-4 rotate-45 rounded-sm border border-blue-400/30 bg-blue-400/10" />
        </div>
        <div className="absolute right-[25%] bottom-[15%] h-2 w-2 anim-glow rounded-full bg-sky-400 max-md:hidden" />
        <div className="absolute left-[45%] top-[8%] anim-drift max-md:hidden">
          <div className="h-6 w-6 rounded-full border border-indigo-400/20 bg-indigo-400/5 backdrop-blur-sm" />
        </div>
        <div className="absolute right-[40%] bottom-[30%] anim-float-slow max-md:hidden">
          <div className="h-5 w-5 rotate-12 rounded-lg border border-blue-400/20 bg-blue-400/5" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-6 pt-24 pb-16 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-300 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Aulas semanais viram aprendizado diário
          </div>
          <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Transforme{" "}
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              aulas semanais
            </span>{" "}
            em aprendizado diário
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-slate-400">
            O Talkion mantém seus alunos praticando todos os dias pelo WhatsApp com conteúdo adaptado
            ao nível deles, quizzes inteligentes e avaliação de speaking por IA. Tudo automático,
            sem trabalho manual para você.
          </p>

          <div className="mx-auto mt-10 grid max-w-3xl gap-3 text-left sm:grid-cols-3">
            <div className="anim-card1 flex items-start gap-3 rounded-xl border border-slate-700/40 bg-white/5 p-4 backdrop-blur">
              <span className="mt-0.5 text-base">📚</span>
              <div>
                <p className="text-sm font-semibold text-white">Crie conteúdo automaticamente</p>
                <p className="text-xs text-slate-400">Notícias reais adaptadas em 3 níveis</p>
              </div>
            </div>
            <div className="anim-card2 flex items-start gap-3 rounded-xl border border-slate-700/40 bg-white/5 p-4 backdrop-blur">
              <span className="mt-0.5 text-base">🗣️</span>
              <div>
                <p className="text-sm font-semibold text-white">Avalie speaking por IA</p>
                <p className="text-xs text-slate-400">Transcrição + feedback automático</p>
              </div>
            </div>
            <div className="anim-card3 flex items-start gap-3 rounded-xl border border-slate-700/40 bg-white/5 p-4 backdrop-blur">
              <span className="mt-0.5 text-base">📊</span>
              <div>
                <p className="text-sm font-semibold text-white">Acompanhe a evolução</p>
                <p className="text-xs text-slate-400">Dashboard completo com métricas reais</p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500"
            >
              Começar Agora
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              onClick={() => scrollTo("features")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700/60 bg-white/5 px-8 py-3.5 text-base font-medium text-slate-300 backdrop-blur transition hover:bg-white/10"
            >
              Ver Funcionalidades
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Benefícios - Para professores */}
      <section id="benefits" className="relative bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">
              <Zap className="h-3.5 w-3.5" />
              Por que usar o Talkion?
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Menos trabalho repetitivo, mais tempo para ensinar
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-500">
              Se você passa horas criando conteúdo, corrigindo atividades e cobrando alunos,
              o Talkion foi feito para você. Automatize o que é repetitivo e foque no que realmente importa.
            </p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-2">
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="group flex gap-5 rounded-2xl border border-slate-200 p-7 transition hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-100">
                  <benefit.icon className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">{benefit.title}</h3>
                  <p className="mt-2 leading-relaxed text-slate-500">{benefit.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="how-it-works" className="relative bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700">
              <BookOpen className="h-3.5 w-3.5" />
              Como Funciona
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Coloque no ar em minutos
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-500">
              Conecte seu WhatsApp, cadastre seus alunos e o Talkion faz o resto.
            </p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-4">
            {steps.map((step) => (
              <div key={step.number}>
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-lg font-bold text-white shadow-lg shadow-emerald-500/20">
                    {step.number}
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="features" className="relative bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
              <LayoutDashboard className="h-3.5 w-3.5" />
              Funcionalidades
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Tudo que você precisa para dar o melhor curso da sua vida
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-500">
              Do conteúdo à correção, da automação ao acompanhamento. O Talkion é o parceiro
              que todo professor de idiomas merece.
            </p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-100">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Público-Alvo */}
      <section id="audience" className="relative bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-700">
              <Users className="h-3.5 w-3.5" />
              Para Quem é o Talkion?
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Professores de todos os idiomas, de todos os modelos de ensino
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-500">
              Se você dá aulas individuais, em grupo, online ou presencial, o Talkion se adapta ao seu formato de trabalho.
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center transition hover:border-amber-200 hover:shadow-lg">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <MessageCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Professor Autônomo</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                Dá aulas particulares ou para pequenos grupos? O Talkion mantém seus alunos engajados entre as aulas
                com conteúdo diário automático. Você ganha tempo e eles praticam todo dia.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center transition hover:border-amber-200 hover:shadow-lg">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <GraduationCap className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Escola ou Curso de Idiomas</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                Gerencie múltiplos professores, turmas e alunos em um só lugar. Cada professor com seu próprio bot,
                sua própria automação e seus próprios dados. Escalável do início ao fim.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center transition hover:border-amber-200 hover:shadow-lg">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <Globe className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Professor de qualquer idioma</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                Inglês, português, espanhol, francês, alemão, italiano, japonês, mandarim — o Talkion não se limita
                a um idioma. A estrutura multilíngue permite ensinar o que você ensina.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Idiomas */}
      <section id="languages" className="relative bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <Globe className="mx-auto h-10 w-10 text-blue-500" />
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Funciona para qualquer idioma
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-500">
              O Talkion foi construído com arquitetura multilíngue desde o primeiro dia. A interface,
              o conteúdo, os quizzes e a avaliação de speaking — tudo suporta qualquer idioma.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {languages.map((lang) => (
              <div
                key={lang.name}
                className="rounded-2xl border-2 border-slate-200 bg-white px-6 py-4 text-center transition hover:border-blue-100 hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <Image
                    src={flagSrc(lang.flag)}
                    alt={lang.name}
                    width={28}
                    height={20}
                    className="h-5 w-7 rounded-[2px] object-cover shadow-sm"
                  />
                  <span className="text-sm font-semibold text-slate-700">
                    {lang.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Números */}
      <section className="relative border-t border-slate-100 bg-slate-50 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {[
              { value: "20h+", label: "Economizadas por semana", icon: Clock },
              { value: "100%", label: "Via WhatsApp", icon: MessageCircle },
              { value: "24/7", label: "Automação contínua", icon: Bot },
              { value: "∞", label: "Idiomas suportados", icon: Globe },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <stat.icon className="h-6 w-6" />
                </div>
                <div className="text-3xl font-bold text-slate-900">{stat.value}</div>
                <div className="mt-1 text-sm text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section className="relative bg-white py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-700">
            <Star className="h-3.5 w-3.5" />
            Depoimentos
          </span>
        </div>
        <div className="relative mx-auto mt-12 max-w-3xl overflow-hidden px-6">
          <div
            className="flex transition-transform duration-700 ease-in-out"
            style={{ transform: `translateX(-${depoimentoIndex * 100}%)` }}
          >
            {depoimentos.map((depo, i) => (
              <div key={i} className="flex w-full shrink-0 justify-center">
                <div className="w-full max-w-xl text-center">
                  <Quote className="mx-auto h-8 w-8 text-blue-300" />
                  <blockquote className="mt-6 text-xl leading-relaxed text-slate-600 italic sm:text-2xl">
                    &ldquo;{depo.texto}&rdquo;
                  </blockquote>
                  <div className="mt-6 flex items-center justify-center gap-2">
                    {Array.from({ length: depo.estrelas }).map((_, s) => (
                      <Star key={s} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-700">— {depo.autor}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Dots */}
          <div className="mt-8 flex items-center justify-center gap-2">
            {depoimentos.map((_, i) => (
              <button
                key={i}
                onClick={() => setDepoimentoIndex(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === depoimentoIndex ? "w-6 bg-blue-600" : "w-2 bg-slate-300"
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Planos + Tabela Comparativa */}
      <section id="plans" className="relative bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">
              <CreditCard className="h-3.5 w-3.5" />
              Planos
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Escolha o plano ideal para sua turma
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-500">
              Automatize a comunicação com seus alunos, economize tempo e mantenha o engajamento das suas aulas.
            </p>
          </div>
          <div className="mx-auto mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">

            {/* Free */}
            <div className="relative flex flex-col rounded-xl border bg-white p-6 transition-all duration-200 hover:shadow-md">
              <div className="text-center pb-2">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
                  <Zap className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="text-xl text-emerald-600 font-semibold">Free</h3>
                <p className="text-xs text-muted-foreground mt-1">Comece gratuitamente. Sem cartão de crédito.</p>
              </div>
              <div className="text-center flex-1 flex flex-col px-2">
                <div className="mb-3">
                  <div className="text-3xl font-bold text-emerald-600">R$ 0</div>
                  <p className="text-xs text-muted-foreground">/mês</p>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600 mx-auto mb-4">
                  <Zap className="h-3 w-3" />
                  5.000 créditos/mês
                </div>
                <ul className="space-y-2 text-left mb-4 flex-1">
                  {[
                    "Até 10 alunos",
                    "Conteúdo diário IA",
                    "Speaking IA",
                    "Quiz inteligente",
                    "Fluxos privados e grupo",
                    "Suporte por e-mail",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground mb-3">Aluno adicional: R$ 3,90/mês</p>
                <button
                  onClick={() => router.push("/login?register=true&plan=Free")}
                  className="mt-auto w-full rounded-lg bg-emerald-50 text-emerald-700 px-3 py-2.5 text-xs font-semibold hover:opacity-80 transition-opacity"
                >
                  Começar Gratuitamente
                </button>
              </div>
            </div>

            {/* Essentials */}
            <div className="relative flex flex-col rounded-xl border bg-white p-6 transition-all duration-200 hover:shadow-md">
              <div className="text-center pb-2">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl text-blue-600 font-semibold">Essentials</h3>
                <p className="text-xs text-muted-foreground mt-1">Para professores que querem automatizar suas aulas.</p>
              </div>
              <div className="text-center flex-1 flex flex-col px-2">
                <div className="mb-3">
                  <div className="text-3xl font-bold">R$ 99,90</div>
                  <p className="text-xs text-muted-foreground">/mês</p>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 mx-auto mb-4">
                  <Zap className="h-3 w-3" />
                  20.000 créditos/mês
                </div>
                <ul className="space-y-2 text-left mb-4 flex-1">
                  {[
                    "Até 50 alunos",
                    "Tudo do Free",
                    "Confirmação de aulas",
                    "Relatórios de evolução",
                    "Suporte online",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground mb-3">Aluno adicional: R$ 3,90/mês</p>
                <button
                  onClick={() => router.push("/login?register=true&plan=Essentials")}
                  className="mt-auto w-full rounded-lg bg-blue-50 text-blue-700 px-3 py-2.5 text-xs font-semibold hover:opacity-80 transition-opacity"
                >
                  Assinar Essentials
                </button>
              </div>
            </div>

            {/* Professional (Destacado) */}
            <div className="relative flex flex-col rounded-xl border-2 border-primary/30 bg-white p-6 shadow-lg scale-[1.02] transition-all duration-200 ring-2 ring-primary">
              <div className="flex justify-center -mt-3 mb-0 relative">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
                  <Star className="h-3 w-3" />
                  MAIS POPULAR
                </span>
              </div>
              <div className="text-center pb-2 pt-2">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Award className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl text-primary font-semibold">Professional</h3>
                <p className="text-xs text-muted-foreground mt-1">Cresça sem aumentar sua carga de trabalho.</p>
              </div>
              <div className="text-center flex-1 flex flex-col px-2">
                <div className="mb-3">
                  <div className="text-3xl font-bold">R$ 199,90</div>
                  <p className="text-xs text-muted-foreground">/mês</p>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mx-auto mb-4">
                  <Zap className="h-3 w-3" />
                  50.000 créditos/mês
                </div>
                <ul className="space-y-2 text-left mb-4 flex-1">
                  {[
                    "Até 100 alunos",
                    "Tudo do Essentials",
                    "Suporte prioritário",
                    "Maior capacidade de IA",
                    "Melhor custo por aluno",
                    "Relatórios completos",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground mb-3">Aluno adicional: R$ 3,90/mês</p>
                <button
                  onClick={() => router.push("/login?register=true&plan=Professional")}
                  className="mt-auto w-full rounded-lg bg-primary/10 text-primary px-3 py-2.5 text-xs font-semibold hover:opacity-80 transition-opacity"
                >
                  Quero o Professional
                </button>
              </div>
            </div>

            {/* School */}
            <div className="relative flex flex-col rounded-xl border bg-white p-6 transition-all duration-200 hover:shadow-md">
              <div className="text-center pb-2">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50">
                  <GraduationCap className="h-6 w-6 text-orange-600" />
                </div>
                <h3 className="text-xl text-orange-600 font-semibold">School</h3>
                <p className="text-xs text-muted-foreground mt-1">Para escolas e equipes de professores.</p>
              </div>
              <div className="text-center flex-1 flex flex-col px-2">
                <div className="mb-3">
                  <div className="text-3xl font-bold">R$ 399,90</div>
                  <p className="text-xs text-muted-foreground">/mês</p>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-600 mx-auto mb-4">
                  <Zap className="h-3 w-3" />
                  120.000 créditos/mês
                </div>
                <ul className="space-y-2 text-left mb-4 flex-1">
                  {[
                    "Até 250 alunos",
                    "Tudo do Professional",
                    "Até 5 professores",
                    "Dashboard administrativo",
                    "Onboarding personalizado",
                    "Suporte dedicado",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground mb-3">Aluno adicional: R$ 3,90/mês</p>
                <button
                  onClick={() => goToContact("School")}
                  className="mt-auto w-full rounded-lg bg-orange-50 text-orange-700 px-3 py-2.5 text-xs font-semibold hover:bg-orange-100 transition-colors"
                >
                  Falar com Especialista
                </button>
              </div>
            </div>

            {/* Enterprise */}
            <div className="relative flex flex-col rounded-xl border bg-white p-6 transition-all duration-200 hover:shadow-md">
              <div className="text-center pb-2">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                  <Building2 className="h-6 w-6 text-slate-700" />
                </div>
                <h3 className="text-xl text-slate-700 font-semibold">Enterprise</h3>
                <p className="text-xs text-muted-foreground mt-1">Para escolas e redes de ensino.</p>
              </div>
              <div className="text-center flex-1 flex flex-col px-2">
                <div className="mb-3">
                  <div className="text-lg font-bold text-slate-700">Sob consulta</div>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 mx-auto mb-4">
                  <Zap className="h-3 w-3" />
                  Créditos personalizados
                </div>
                <ul className="space-y-2 text-left mb-4 flex-1">
                  {[
                    "Professores ilimitados",
                    "API e integrações",
                    "SLA dedicado",
                    "Gerente de sucesso",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground mb-3">&nbsp;</p>
                <button
                  onClick={() => goToContact("Enterprise")}
                  className="mt-auto w-full rounded-lg bg-slate-900 text-white px-3 py-2.5 text-xs font-semibold hover:bg-slate-800 transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Solicitar Proposta
                </button>
              </div>
            </div>
          </div>
          <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-muted-foreground">
            Todos os planos possuem as mesmas funcionalidades. A diferença está na quantidade de alunos,
            créditos de IA e professores que você pode gerenciar.
          </p>
        </div>

        <div className="mx-auto max-w-7xl px-6 mt-20">
          <h2 className="text-2xl font-bold mb-8">Compare todos os planos</h2>
          <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Recursos</th>
                    {["Free", "Essentials", "Professional", "School"].map(name => {
                      const colors: Record<string, string> = {
                        Free: "text-emerald-600",
                        Essentials: "text-blue-600",
                        Professional: "text-primary",
                        School: "text-orange-600",
                      };
                      return (
                        <th key={name} className={`px-4 py-3 text-center font-semibold ${colors[name] || ""}`}>
                          {name}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Alunos", free: "10", essentials: "50", professional: "100", school: "250" },
                    { label: "Créditos mensais", free: "5.000", essentials: "20.000", professional: "50.000", school: "120.000" },
                    { label: "Conteúdo diário IA", free: true, essentials: true, professional: true, school: true },
                    { label: "Speaking IA", free: true, essentials: true, professional: true, school: true },
                    { label: "Quiz inteligente", free: true, essentials: true, professional: true, school: true },
                    { label: "Dashboard completo", free: "—", essentials: true, professional: true, school: true },
                    { label: "Fluxos privados", free: true, essentials: true, professional: true, school: true },
                    { label: "Fluxos em grupo", free: true, essentials: true, professional: true, school: true },
                    { label: "Gestão de alunos", free: true, essentials: true, professional: true, school: true },
                    { label: "Automações", free: "—", essentials: true, professional: true, school: true },
                    { label: "Confirmação de aulas", free: "—", essentials: true, professional: true, school: true },
                    { label: "Agendamento", free: "—", essentials: true, professional: true, school: true },
                    { label: "Suporte prioritário", free: "—", essentials: "—", professional: true, school: true },
                    { label: "Até 5 professores", free: "—", essentials: "—", professional: "—", school: true },
                  ].map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                      <td className="px-4 py-2.5 text-muted-foreground">{row.label}</td>
                      {(["free", "essentials", "professional", "school"] as const).map(key => {
                        const val = row[key];
                        return (
                          <td key={key} className="px-4 py-2.5 text-center">
                            {val === true ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                            ) : (
                              <span className="text-muted-foreground">{String(val)}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-4 w-full lg:w-72">
              <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="pt-5 p-5">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Créditos adicionais
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Pacotes de créditos extras que nunca expiram.
                  </p>
                  <div className="space-y-2">
                    {[
                      { credits: "5.000", price: "R$ 29,90" },
                      { credits: "20.000", price: "R$ 99,90" },
                      { credits: "50.000", price: "R$ 199,90" },
                      { credits: "100.000", price: "R$ 299,90" },
                    ].map((pack, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{pack.credits} créditos</span>
                        <span className="font-semibold">{pack.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="pt-5 p-5">
                  <h3 className="font-semibold text-sm mb-3">O que são créditos?</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                    Cada recurso de IA consome créditos. Seus créditos são renovados mensalmente com a assinatura.
                  </p>
                  <ul className="space-y-1.5">
                    {["Conteúdo personalizado", "Quizzes", "Speaking", "Transcrição", "Texto para voz", "Geração de imagens"].map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative bg-white py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-1.5 text-sm font-medium text-slate-700">
              <HelpCircle className="h-3.5 w-3.5" />
              Perguntas Frequentes
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Ainda com dúvidas?
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-500">
              As principais perguntas que nossos professores fazem antes de começar.
            </p>
          </div>
          <div className="mx-auto mt-12 max-w-3xl space-y-3">
            {faq.map((item, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-2xl border border-slate-200 transition hover:border-slate-300"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-slate-50"
                >
                  <span className="text-base font-semibold text-slate-900">{item.question}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${
                      openFaq === index ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-200 ${
                    openFaq === index ? "max-h-48" : "max-h-0"
                  }`}
                >
                  <p className="border-t border-slate-100 px-6 py-5 text-sm leading-relaxed text-slate-500">
                    {item.answer}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contato */}
      <section id="contact" className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-24">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:52px_52px] opacity-20" />
        <div className="relative z-10 mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-4 py-1.5 text-sm font-medium text-blue-300 backdrop-blur border border-blue-400/20">
              <Mail className="h-3.5 w-3.5" />
              Contato
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Quer levar o Talkion para suas aulas?
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-400">
              Tem interesse em usar o Talkion com seus alunos? Quer saber mais, pedir uma demonstração
              ou conversar sobre como podemos ajudar? Mande uma mensagem.
            </p>
          </div>
          <div className="mx-auto mt-12 max-w-lg">
            <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setContactLoading(true);
                  setContactSuccess(false);
                  setContactError("");

                  const form = e.target as HTMLFormElement;
                  const data = new FormData(form);

                  const website = data.get("website") as string;
                  if (website) return;

                  const nome = data.get("nome") as string;
                  const email = data.get("email") as string;
                  const mensagem = data.get("mensagem") as string;

                  let turnstileToken = "";
                  try {
                    turnstileToken =
                      (window as any).turnstile?.getResponse() || "";
                    if (!turnstileToken) {
                      setContactError(
                        "Verifique o Captcha antes de enviar."
                      );
                      setContactLoading(false);
                      return;
                    }
                  } catch {
                    setContactError("Erro ao verificar Captcha.");
                    setContactLoading(false);
                    return;
                  }

                  try {
                    const res = await fetch(
                      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/contact`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          nome,
                          email,
                          mensagem,
                          turnstileToken,
                        }),
                      }
                    );

                    const result = await res.json();

                    if (result.success) {
                      setContactSuccess(true);
                      form.reset();
                      (window as any).turnstile?.reset();
                    } else {
                      setContactError(
                        result.message || "Erro ao enviar mensagem."
                      );
                      (window as any).turnstile?.reset();
                    }
                  } catch {
                    setContactError(
                      "Erro de conexão. Verifique sua internet e tente novamente."
                    );
                  } finally {
                    setContactLoading(false);
                  }
                }}
                className="space-y-5"
              >
              <div className="absolute opacity-0 pointer-events-none" aria-hidden="true">
                <label htmlFor="website">Nao preencher</label>
                <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>
              <div>
                <label htmlFor="nome" className="mb-1.5 block text-sm font-medium text-slate-400">
                  Nome
                </label>
                <input
                  id="nome"
                  name="nome"
                  type="text"
                  required
                  placeholder="Seu nome completo"
                  className="w-full rounded-xl border border-slate-700/60 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 backdrop-blur transition focus:border-blue-500/50 focus:bg-white/10 focus:outline-none"
                />
                {showContactHint && (
                  <p className="mt-1.5 text-xs text-blue-400">Preencha seu nome para receber as informações.</p>
                )}
              </div>
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-400">
                  E-mail
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="seu@email.com"
                  className="w-full rounded-xl border border-slate-700/60 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 backdrop-blur transition focus:border-blue-500/50 focus:bg-white/10 focus:outline-none"
                />
                {showContactHint && (
                  <p className="mt-1.5 text-xs text-blue-400">Preencha seu email para receber as informações.</p>
                )}
              </div>
              <div>
                <label htmlFor="mensagem" className="mb-1.5 block text-sm font-medium text-slate-400">
                  Mensagem
                </label>
                <textarea
                  id="mensagem"
                  name="mensagem"
                  required
                  rows={4}
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  className="w-full resize-none rounded-xl border border-slate-700/60 bg-white/5 px-4 py-3 text-sm text-white backdrop-blur transition focus:border-blue-500/50 focus:bg-white/10 focus:outline-none"
                />
              </div>
              {contactSuccess && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-300">
                  Mensagem enviada com sucesso! Responderemos em breve.
                </div>
              )}
              {contactError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
                  {contactError}
                </div>
              )}
              <div className="flex justify-center">
                <div ref={turnstileRef} className="cf-turnstile-widget" />
              </div>
              <button
                type="submit"
                disabled={contactLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {contactLoading ? (
                  <>Enviando...</>
                ) : (
                  <>
                    Enviar Mensagem
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
              <p className="text-center text-sm text-slate-500">
                Respondemos em até 24 horas úteis.
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* Back to top */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-8 right-8 z-50 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition-all duration-300 hover:bg-blue-500 hover:scale-105 ${
          showTop
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
        aria-label="Voltar ao topo"
      >
        <ArrowUp className="h-5 w-5" />
      </button>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <Link href="/" className="inline-flex items-center gap-2.5 rounded-full bg-slate-950 px-3.5 py-1.5 text-white ring-1 ring-slate-800 transition hover:bg-slate-800">
              <Image
                src="/logo-branco.png"
                alt="Talkion"
                width={22}
                height={22}
                className="h-5 w-5 shrink-0 object-contain"
              />
              <span className="text-lg font-semibold tracking-tight">Talkion</span>
            </Link>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <button onClick={() => scrollTo("benefits")} className="transition hover:text-slate-300">
                Por que usar?
              </button>
              <button onClick={() => scrollTo("features")} className="transition hover:text-slate-300">
                Funcionalidades
              </button>
              <button onClick={() => scrollTo("plans")} className="transition hover:text-slate-300">
                Planos
              </button>
              <button onClick={() => scrollTo("faq")} className="transition hover:text-slate-300">
                FAQ
              </button>
            </div>
          </div>
          <div className="mt-8 border-t border-slate-800 pt-8 text-center text-sm text-slate-600">
            &copy; 2026 Talkion. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}

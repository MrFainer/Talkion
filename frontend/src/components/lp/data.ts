import {
  BookOpen,
  Building2,
  Clock,
  Globe,
  GraduationCap,
  LayoutDashboard,
  MessageCircle,
  Mic,
  Newspaper,
  Repeat,
  Smartphone,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Conteúdo da LP (`/lp`).
 *
 * Preços, créditos e limites de plano são os MESMOS da home (`src/app/page.tsx`),
 * que continua sendo a página institucional. Se um preço mudar lá, muda aqui também.
 */

export type Plano = {
  nome: string;
  preco: string;
  periodo?: string;
  resumo: string;
  creditos: string;
  recursos: string[];
  cta: string;
  href: string;
  destaque?: boolean;
  alunoAdicional?: string;
};

export const planos: Plano[] = [
  {
    nome: "Free",
    preco: "R$ 0",
    periodo: "/mês",
    resumo: "Para testar com a sua próxima turma.",
    creditos: "2.000 créditos",
    recursos: ["Até 3 alunos", "Conteúdo diário com IA", "Speaking com IA", "Quiz inteligente", "Suporte por e-mail"],
    cta: "Começar grátis",
    href: "/login?register=true&plan=Free",
    alunoAdicional: "Aluno adicional: R$ 3,90/mês",
  },
  {
    nome: "Essentials",
    preco: "R$ 99,90",
    periodo: "/mês",
    resumo: "Para o professor que quer parar de preparar material.",
    creditos: "20.000 créditos/mês",
    recursos: ["Até 50 alunos", "Tudo do Free", "Confirmação de aulas", "Relatórios de evolução", "Suporte online"],
    cta: "Assinar Essentials",
    href: "/login?register=true&plan=Essentials",
    alunoAdicional: "Aluno adicional: R$ 3,90/mês",
  },
  {
    nome: "Professional",
    preco: "R$ 199,90",
    periodo: "/mês",
    resumo: "Para crescer sem aumentar a carga de trabalho.",
    creditos: "50.000 créditos/mês",
    recursos: [
      "Até 100 alunos",
      "Tudo do Essentials",
      "Suporte prioritário",
      "Maior capacidade de IA",
      "Relatórios completos",
    ],
    cta: "Quero o Professional",
    href: "/login?register=true&plan=Professional",
    destaque: true,
    alunoAdicional: "Aluno adicional: R$ 3,90/mês",
  },
  {
    nome: "School",
    preco: "R$ 399,90",
    periodo: "/mês",
    resumo: "Para escolas e equipes de professores.",
    creditos: "120.000 créditos/mês",
    recursos: [
      "Até 250 alunos",
      "Tudo do Professional",
      "Até 5 professores",
      "Dashboard administrativo",
      "Onboarding personalizado",
      "Suporte dedicado",
    ],
    cta: "Falar com especialista",
    href: "/#contact",
    alunoAdicional: "Aluno adicional: R$ 3,90/mês",
  },
];

export const dores: { icon: LucideIcon; titulo: string; texto: string }[] = [
  {
    icon: Clock,
    titulo: "Sua semana vira fábrica de conteúdo",
    texto:
      "Achar notícia no nível certo, montar quiz, corrigir áudio de cada aluno. É conteúdo novo toda semana — e o trabalho cresce junto com a turma.",
  },
  {
    icon: MessageCircle,
    titulo: "Seis dias de silêncio entre as aulas",
    texto:
      "O aluno pratica uma vez por semana. Vocabulário não fixa, o speaking trava, e na aula seguinte metade do conteúdo já foi embora.",
  },
  {
    icon: TrendingUp,
    titulo: "Sem número para mostrar evolução",
    texto:
      "Você sente que o aluno melhorou, mas não tem dado para provar — nem para o aluno, nem para os pais, nem para renovar a matrícula.",
  },
];

export const passos: { titulo: string; texto: string }[] = [
  {
    titulo: "Cadastre o aluno e o nível",
    texto: "Você informa nome, WhatsApp e nível. Leva menos de um minuto por aluno.",
  },
  {
    titulo: "O Talkion envia a notícia do dia",
    texto: "Conteúdo real, adaptado ao nível, no privado para o speaking e no grupo para a leitura.",
  },
  {
    titulo: "O aluno responde no WhatsApp",
    texto: "Quiz de múltipla escolha e áudio de speaking. O gabarito chega no ciclo seguinte.",
  },
  {
    titulo: "A IA corrige e você acompanha",
    texto: "Transcrição, feedback pedagógico e dashboard com dias de prática e evolução de cada aluno.",
  },
];

export const recursos: { icon: LucideIcon; titulo: string; texto: string }[] = [
  {
    icon: Newspaper,
    titulo: "Notícia real, todo dia",
    texto: "Conteúdo atual adaptado ao nível do aluno, com fallback por IA quando a fonte falha.",
  },
  {
    icon: Mic,
    titulo: "Speaking corrigido por IA",
    texto: "O aluno grava áudio, a IA transcreve e devolve feedback de pronúncia e fluência em português.",
  },
  {
    icon: BookOpen,
    titulo: "Quiz com gabarito no ciclo seguinte",
    texto: "Três perguntas e três alternativas por dia. Resposta por mensagem citada, sem confusão no grupo.",
  },
  {
    icon: Repeat,
    titulo: "Fluxo privado e em grupo",
    texto: "Privado para prática individual de speaking; grupo para leitura e quiz coletivo.",
  },
  {
    icon: Globe,
    titulo: "Oito idiomas",
    texto: "Inglês, português, espanhol, francês, alemão, italiano, japonês e mandarim.",
  },
  {
    icon: LayoutDashboard,
    titulo: "Dashboard de evolução",
    texto: "Dias de prática, acertos e notas de speaking por aluno — a prova de que a rotina funciona.",
  },
];

export const publico: { icon: LucideIcon; titulo: string; texto: string }[] = [
  {
    icon: GraduationCap,
    titulo: "Professor autônomo",
    texto: "Você dá aula sozinho e não quer virar produtor de material. A automação assume a rotina diária.",
  },
  {
    icon: Building2,
    titulo: "Escola ou curso de idiomas",
    texto: "Padronize a prática entre professores, com dashboard administrativo e acompanhamento por turma.",
  },
  {
    icon: Smartphone,
    titulo: "Qualquer idioma",
    texto: "Se o aluno tem WhatsApp, ele pratica. Sem app para instalar e sem login para lembrar.",
  },
];

export const numeros: { valor: string; rotulo: string }[] = [
  { valor: "100%", rotulo: "no WhatsApp do aluno" },
  { valor: "24/7", rotulo: "rotina automática" },
  { valor: "8", rotulo: "idiomas suportados" },
  { valor: "20h+", rotulo: "economizadas por semana" },
];

export const depoimentos: { texto: string; autor: string }[] = [
  {
    texto:
      "Antes eu passava horas criando material e corrigindo exercícios. Hoje meus alunos praticam todo dia pelo WhatsApp enquanto eu foco no que realmente importa: dar aulas.",
    autor: "Professora de inglês — SP",
  },
  {
    texto:
      "O engajamento dos meus alunos disparou depois que comecei a usar o Talkion. Eles praticam todo dia e eu vejo a evolução pelo dashboard.",
    autor: "Professor de espanhol — RJ",
  },
  {
    texto:
      "Consegui escalar minhas turmas sem aumentar minha carga horária. O Talkion cuida da rotina de estudos enquanto eu dou atenção a cada aluno.",
    autor: "Escola de idiomas — MG",
  },
];

export const faq: { pergunta: string; resposta: string }[] = [
  {
    pergunta: "Preciso instalar algum aplicativo?",
    resposta:
      "Não. O aluno recebe tudo no WhatsApp que ele já usa. Você acompanha pelo painel do Talkion no navegador.",
  },
  {
    pergunta: "O plano gratuito tem prazo?",
    resposta:
      "Não tem prazo e não pede cartão de crédito. São 2.000 créditos para testar com até 3 alunos.",
  },
  {
    pergunta: "Todos os planos têm as mesmas funcionalidades?",
    resposta:
      "Sim. Todos os planos têm acesso às mesmas funcionalidades. A diferença está na quantidade de alunos, de créditos de IA e de professores que você pode gerenciar.",
  },
  {
    pergunta: "Os créditos acumulam?",
    resposta:
      "Os créditos do plano são renovados todo mês. Os créditos extras comprados à parte não expiram e se somam aos do plano.",
  },
  {
    pergunta: "Posso trocar de plano depois?",
    resposta:
      "Sim, upgrade ou downgrade a qualquer momento. O valor é recalculado proporcionalmente aos dias restantes do ciclo.",
  },
  {
    pergunta: "Serve para qualquer idioma?",
    resposta:
      "Sim. Inglês, português, espanhol, francês, alemão, italiano, japonês e mandarim — com conteúdo no nível de cada aluno.",
  },
];

export const idiomas = [
  { nome: "Inglês", code: "gb" },
  { nome: "Português", code: "br" },
  { nome: "Espanhol", code: "es" },
  { nome: "Francês", code: "fr" },
  { nome: "Alemão", code: "de" },
  { nome: "Italiano", code: "it" },
  { nome: "Japonês", code: "jp" },
  { nome: "Mandarim", code: "cn" },
];

export const iconesConfianca: LucideIcon[] = [Users, MessageCircle, Clock];

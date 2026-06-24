export const CREDIT_ACTION_COPY: Record<
  string,
  {
    name: string;
    description: string;
  }
> = {
  news_capture_level_1: {
    name: 'Captura de notícia Nível 1',
    description: 'Captura de notícia por scraping para nível 1',
  },
  news_capture_level_2: {
    name: 'Captura de notícia Nível 2',
    description: 'Captura de notícia por scraping para nível 2',
  },
  news_capture_level_3: {
    name: 'Captura de notícia Nível 3',
    description: 'Captura de notícia por scraping para nível 3',
  },
  news_ai_fallback: {
    name: 'Notícia gerada por IA (fallback)',
    description: 'Geração de notícia via IA quando scraping falha',
  },
  news_tts: {
    name: 'Áudio TTS da notícia',
    description: 'Geração de áudio por texto-fala para notícia',
  },
  quiz_generation: {
    name: 'Quiz gerado para um nível',
    description: 'Geração de quiz para uma notícia em um nível',
  },
  quick_tip_generation: {
    name: 'Geração de Quick Tip',
    description: 'Geração de dica de inglês via IA para grupos',
  },
  news_quiz_group_send: {
    name: 'Envio da notícia + quiz para grupo',
    description: 'Envio da notícia e quiz para grupo de WhatsApp',
  },
  quiz_response_received: {
    name: 'Receber resposta do quiz',
    description: 'Processamento de resposta de quiz recebida',
  },
  quiz_response_metrics: {
    name: 'Salvar métricas da resposta',
    description: 'Armazenamento de métricas da resposta do quiz',
  },
  news_individual_send: {
    name: 'Envio individual de notícia',
    description: 'Envio de notícia individual para aluno',
  },
  speaking_transcription: {
    name: 'Transcrição de áudio',
    description: 'Transcrição de áudio do aluno via IA',
  },
  speaking_feedback: {
    name: 'Feedback da IA',
    description: 'Geração de feedback de speaking pela IA',
  },
  lesson_confirmation_send: {
    name: 'Envio de confirmação de aula',
    description: 'Envio de mensagem de confirmação de aula',
  },
  lesson_confirmation_process: {
    name: 'Interpretação da resposta pela IA',
    description: 'Processamento da resposta de confirmação pela IA',
  },
  weekly_summary_send: {
    name: 'Envio de resumo semanal',
    description: 'Envio de resumo semanal de aulas para o aluno',
  },
  weekly_summary_process: {
    name: 'Processamento de resposta do resumo semanal',
    description: 'Interpretação da resposta do resumo semanal pela IA',
  },
  content_generation: {
    name: 'Geração de conteúdo educacional',
    description: 'Geração de conteúdo de inglês baseado em tendências',
  },
};

export function getCreditActionCopy(key: string) {
  return CREDIT_ACTION_COPY[key];
}

export class CreateContentDto {
  title: string;
  type: 'VOCABULARY' | 'TIPS' | 'QUIZ' | 'INFORMATIVE' | 'CURIOSITY';
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  trendTopic?: string;
  trendArea?: string;
  promptUsed?: string;
  aiModel?: string;
  generationMetadata?: Record<string, unknown>;
  singlePost?: string;
  carousel?: Array<{ title: string; body: string; vocabulary?: string }>;
  description?: string;
  quizQuestions?: Array<{
    question: string;
    options: string[];
    correctAnswer: string;
  }>;
  tags?: string[];
  favorite?: boolean;
  source?: string;
}

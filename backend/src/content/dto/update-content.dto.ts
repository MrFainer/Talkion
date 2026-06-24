export class UpdateContentDto {
  title?: string;
  type?: 'VOCABULARY' | 'TIPS' | 'QUIZ' | 'INFORMATIVE' | 'CURIOSITY';
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  singlePost?: string;
  carousel?: Array<{ title: string; body: string; vocabulary?: string }>;
  description?: string;
  quizQuestions?: Array<{
    question: string;
    options: string[];
    correctAnswer: string;
  }>;
  tags?: string[];
}

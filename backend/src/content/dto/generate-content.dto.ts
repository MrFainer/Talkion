export class GenerateContentDto {
  topic: string;
  type: 'VOCABULARY' | 'TIPS' | 'QUIZ' | 'INFORMATIVE' | 'CURIOSITY';
  tone?: string;
  level?: string;
  platform?: string;
  trendTopic?: string;
  trendArea?: string;
}

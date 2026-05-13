import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappService } from './whatsapp.service';
import { PrismaService } from '../prisma.service';
import { AiService } from '../ai/ai.service';
import { QuizService } from '../quiz/quiz.service';
import { NewsService } from '../news/news.service';

describe('WhatsappService', () => {
  let service: WhatsappService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: AiService,
          useValue: {},
        },
        {
          provide: QuizService,
          useValue: {},
        },
        {
          provide: NewsService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<WhatsappService>(WhatsappService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

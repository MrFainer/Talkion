import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AiService } from '../ai/ai.service';
import { CreditsService } from '../credits/credits.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { GenerateContentDto } from './dto/generate-content.dto';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly creditsService: CreditsService,
  ) {}

  async generate(teacherId: string, dto: GenerateContentDto) {
    // 1) Verificar créditos antes de gerar
    await this.creditsService.requireCredits(teacherId, 'content_generation');

    // 2) Chamar IA
    const result = await this.aiService.generateContentFromTrend({
      teacherId,
      topic: dto.topic,
      type: dto.type,
      tone: dto.tone,
      level: dto.level,
      platform: dto.platform,
    });

    // 3) Auto-salvar o conteúdo como rascunho para referência
    const content = await this.prisma.content.create({
      data: {
        teacher_id: teacherId,
        title: dto.topic,
        type: dto.type,
        status: 'DRAFT',
        trend_topic: dto.trendTopic || dto.topic,
        trend_area: dto.trendArea,
        prompt_used: result.promptUsed,
        ai_model: result.aiModel || 'gpt-4o-mini',
        generation_metadata: undefined,
        single_post: result.singlePost,
        carousel: (result.carousel as Prisma.InputJsonValue) ?? [],
        description: result.description,
        quiz_questions: result.quizQuestions as
          | Prisma.InputJsonValue
          | undefined,
        tags: [dto.type.toLowerCase()],
        source: 'trend',
      },
    });

    // 4) Debitar créditos após gerar e salvar
    try {
      await this.creditsService.deductCredits(
        teacherId,
        'content_generation',
        'content',
        content.id,
      );
    } catch (error) {
      this.logger.warn(
        `Falha ao debitar créditos para ${content.id}: ${error}`,
      );
    }

    return {
      ...result,
      savedId: content.id,
    };
  }

  async create(teacherId: string, dto: CreateContentDto) {
    const content = await this.prisma.content.create({
      data: {
        teacher_id: teacherId,
        title: dto.title,
        type: dto.type,
        status: dto.status || 'DRAFT',
        trend_topic: dto.trendTopic,
        trend_area: dto.trendArea,
        prompt_used: dto.promptUsed,
        ai_model: dto.aiModel || 'gpt-4o-mini',
        generation_metadata: (dto.generationMetadata ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        single_post: dto.singlePost,
        carousel: (dto.carousel as Prisma.InputJsonValue) ?? [],
        description: dto.description,
        quiz_questions: dto.quizQuestions ?? undefined,
        tags: (dto.tags as Prisma.InputJsonValue) ?? [],
        favorite: dto.favorite ?? false,
        source: dto.source ?? 'trend',
      },
    });

    return content;
  }

  async findAll(
    teacherId: string,
    params: {
      search?: string;
      type?: string;
      favorite?: boolean;
      sort?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const {
      search,
      type,
      favorite,
      sort = 'recent',
      page = 1,
      limit = 20,
    } = params;

    const where: any = {
      teacher_id: teacherId,
      deleted_at: null,
    };

    if (type && type !== 'all') {
      where.type = type;
    }

    if (favorite !== undefined) {
      where.favorite = favorite;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { trend_topic: { contains: search, mode: 'insensitive' } },
        { tags: { string_contains: search } },
      ];
    }

    let orderBy: any = { created_at: 'desc' };
    if (sort === 'favorite') orderBy = { favorite: 'desc', created_at: 'desc' };
    if (sort === 'type') orderBy = { type: 'asc', created_at: 'desc' };

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.content.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.content.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, teacherId: string) {
    const content = await this.prisma.content.findFirst({
      where: { id, teacher_id: teacherId, deleted_at: null },
    });

    if (!content) {
      throw new NotFoundException('Conteúdo não encontrado');
    }

    return content;
  }

  async update(id: string, teacherId: string, dto: UpdateContentDto) {
    const existing = await this.findOne(id, teacherId);

    const data: any = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.singlePost !== undefined) data.single_post = dto.singlePost;
    if (dto.carousel !== undefined) data.carousel = dto.carousel;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.quizQuestions !== undefined)
      data.quiz_questions = dto.quizQuestions;
    if (dto.tags !== undefined) data.tags = dto.tags;

    data.version = { increment: 1 };

    return this.prisma.content.update({
      where: { id },
      data,
    });
  }

  async toggleFavorite(id: string, teacherId: string) {
    const content = await this.findOne(id, teacherId);
    return this.prisma.content.update({
      where: { id },
      data: { favorite: !content.favorite },
    });
  }

  async softDelete(id: string, teacherId: string) {
    await this.findOne(id, teacherId);
    return this.prisma.content.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }
}

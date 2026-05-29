import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CostAction, CostProvider, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export type BillingFilters = {
  teacherId: string;
  from?: string;
  to?: string;
  limit?: number;
};

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getTeacherDashboard(filters: BillingFilters) {
    const teacher = await this.getTeacher(filters.teacherId);
    const where = this.buildWhere(filters);
    const [events, students] = await Promise.all([
      this.prisma.usageCostEvent.findMany({
        where,
        orderBy: { created_at: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              full_name: true,
              whatsapp_number: true,
              english_level: true,
              active: true,
            },
          },
        },
      }),
      this.prisma.student.findMany({
        where: { teacher_id: filters.teacherId },
        orderBy: { full_name: 'asc' },
        select: {
          id: true,
          full_name: true,
          whatsapp_number: true,
          english_level: true,
          active: true,
        },
      }),
    ]);

    return {
      teacher,
      period: this.buildPeriod(filters),
      totals: this.buildTotals(events),
      providers: this.buildProviderSummary(events),
      actions: this.buildActionSummary(events),
      models: this.buildModelSummary(events),
      students: this.buildStudentSummary(events, students),
      daily: this.buildDailySummary(events),
      recentEvents: events.slice(0, 20).map((event) => this.serializeEvent(event)),
    };
  }

  async getTeacherEvents(filters: BillingFilters) {
    await this.getTeacher(filters.teacherId);
    const where = this.buildWhere(filters);
    const limit = this.normalizeLimit(filters.limit, 100);
    const events = await this.prisma.usageCostEvent.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      include: {
        student: {
          select: {
            id: true,
            full_name: true,
            whatsapp_number: true,
            english_level: true,
          },
        },
      },
    });

    return {
      teacherId: filters.teacherId,
      period: this.buildPeriod(filters),
      total: events.length,
      items: events.map((event) => this.serializeEvent(event)),
    };
  }

  async getTeacherStudentBreakdown(filters: BillingFilters) {
    await this.getTeacher(filters.teacherId);
    const where = this.buildWhere(filters);
    const [events, students] = await Promise.all([
      this.prisma.usageCostEvent.findMany({
        where,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.student.findMany({
        where: { teacher_id: filters.teacherId },
        orderBy: { full_name: 'asc' },
        select: {
          id: true,
          full_name: true,
          whatsapp_number: true,
          english_level: true,
          active: true,
        },
      }),
    ]);

    return {
      teacherId: filters.teacherId,
      period: this.buildPeriod(filters),
      items: this.buildStudentSummary(events, students),
    };
  }

  async getTeacherActionBreakdown(filters: BillingFilters) {
    await this.getTeacher(filters.teacherId);
    const where = this.buildWhere(filters);
    const events = await this.prisma.usageCostEvent.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    return {
      teacherId: filters.teacherId,
      period: this.buildPeriod(filters),
      providers: this.buildProviderSummary(events),
      actions: this.buildActionSummary(events),
      models: this.buildModelSummary(events),
    };
  }

  private async getTeacher(teacherId: string) {
    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
      },
    });

    if (!teacher) {
      throw new NotFoundException('Professor não encontrado.');
    }

    return teacher;
  }

  private buildWhere(filters: BillingFilters): Prisma.UsageCostEventWhereInput {
    const period = this.buildPeriod(filters);

    return {
      teacher_id: filters.teacherId,
      created_at: {
        gte: period.fromDate,
        lte: period.toDate,
      },
    };
  }

  private buildPeriod(filters: BillingFilters) {
    const now = new Date();
    const fromDate = filters.from
      ? this.parseDate(filters.from, 'from')
      : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const toDate = filters.to
      ? this.parseDate(filters.to, 'to', true)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      fromDate,
      toDate,
    };
  }

  private parseDate(value: string, field: 'from' | 'to', endOfDay = false) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Data inválida no campo ${field}.`);
    }

    if (endOfDay) {
      parsed.setHours(23, 59, 59, 999);
    } else {
      parsed.setHours(0, 0, 0, 0);
    }

    return parsed;
  }

  private buildTotals(events: Array<any>) {
    const totals = this.sumCostFields(events);

    return {
      events: events.length,
      estimatedCostUsd: totals.usd,
      estimatedCostBrl: totals.brl,
      totalInputTokens: this.sumNumber(events, 'input_tokens'),
      totalOutputTokens: this.sumNumber(events, 'output_tokens'),
      totalCachedInputTokens: this.sumNumber(events, 'cached_input_tokens'),
      totalTokens: this.sumNumber(events, 'total_tokens'),
      totalAudioSeconds: this.sumNumber(events, 'audio_seconds'),
      totalQuantity: this.roundNumber(this.sumNumber(events, 'quantity')),
    };
  }

  private buildProviderSummary(events: Array<any>) {
    const providers = Object.values(CostProvider).map((provider) => {
      const subset = events.filter((event) => event.provider === provider);
      const totals = this.sumCostFields(subset);

      return {
        provider,
        events: subset.length,
        estimatedCostUsd: totals.usd,
        estimatedCostBrl: totals.brl,
      };
    });

    return providers.filter((item) => item.events > 0);
  }

  private buildActionSummary(events: Array<any>) {
    const actions = Object.values(CostAction).map((action) => {
      const subset = events.filter((event) => event.action === action);
      const totals = this.sumCostFields(subset);

      return {
        action,
        events: subset.length,
        estimatedCostUsd: totals.usd,
        estimatedCostBrl: totals.brl,
        totalInputTokens: this.sumNumber(subset, 'input_tokens'),
        totalOutputTokens: this.sumNumber(subset, 'output_tokens'),
        totalTokens: this.sumNumber(subset, 'total_tokens'),
        totalAudioSeconds: this.sumNumber(subset, 'audio_seconds'),
        totalQuantity: this.sumNumber(subset, 'quantity'),
      };
    });

    return actions.filter((item) => item.events > 0);
  }

  private buildModelSummary(events: Array<any>) {
    const groups = new Map<
      string,
      {
        modelName: string;
        events: number;
        estimatedCostUsd: number;
        estimatedCostBrl: number;
      }
    >();

    for (const event of events) {
      const key = event.model_name || 'N/A';
      const existing = groups.get(key) || {
        modelName: key,
        events: 0,
        estimatedCostUsd: 0,
        estimatedCostBrl: 0,
      };

      existing.events += 1;
      existing.estimatedCostUsd += Number(event.estimated_cost_usd || 0);
      existing.estimatedCostBrl += Number(event.estimated_cost_brl || 0);
      groups.set(key, existing);
    }

    return [...groups.values()]
      .map((item) => ({
        ...item,
        estimatedCostUsd: this.roundNumber(item.estimatedCostUsd),
        estimatedCostBrl: this.roundNumber(item.estimatedCostBrl),
      }))
      .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd);
  }

  private buildStudentSummary(events: Array<any>, students: Array<any>) {
    const eventsByStudent = new Map<string, Array<any>>();

    for (const event of events) {
      if (!event.student_id) {
        continue;
      }

      const list = eventsByStudent.get(event.student_id) || [];
      list.push(event);
      eventsByStudent.set(event.student_id, list);
    }

    return students.map((student) => {
      const subset = eventsByStudent.get(student.id) || [];
      const totals = this.sumCostFields(subset);

      return {
        studentId: student.id,
        fullName: student.full_name,
        whatsappNumber: student.whatsapp_number,
        englishLevel: student.english_level,
        active: student.active,
        events: subset.length,
        estimatedCostUsd: totals.usd,
        estimatedCostBrl: totals.brl,
        totalInputTokens: this.sumNumber(subset, 'input_tokens'),
        totalOutputTokens: this.sumNumber(subset, 'output_tokens'),
        totalTokens: this.sumNumber(subset, 'total_tokens'),
        totalAudioSeconds: this.sumNumber(subset, 'audio_seconds'),
      };
    });
  }

  private buildDailySummary(events: Array<any>) {
    const groups = new Map<
      string,
      {
        date: string;
        events: number;
        estimatedCostUsd: number;
        estimatedCostBrl: number;
        totalInputTokens: number;
        totalOutputTokens: number;
        totalCachedInputTokens: number;
        totalTokens: number;
        totalAudioSeconds: number;
      }
    >();

    for (const event of events) {
      const date = new Date(event.created_at).toISOString().slice(0, 10);
      const current = groups.get(date) || {
        date,
        events: 0,
        estimatedCostUsd: 0,
        estimatedCostBrl: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCachedInputTokens: 0,
        totalTokens: 0,
        totalAudioSeconds: 0,
      };

      current.events += 1;
      current.estimatedCostUsd += Number(event.estimated_cost_usd || 0);
      current.estimatedCostBrl += Number(event.estimated_cost_brl || 0);
      current.totalInputTokens += Number(event.input_tokens || 0);
      current.totalOutputTokens += Number(event.output_tokens || 0);
      current.totalCachedInputTokens += Number(event.cached_input_tokens || 0);
      current.totalTokens += Number(event.total_tokens || 0);
      current.totalAudioSeconds += Number(event.audio_seconds || 0);
      groups.set(date, current);
    }

    return [...groups.values()]
      .map((item) => ({
        ...item,
        estimatedCostUsd: this.roundNumber(item.estimatedCostUsd),
        estimatedCostBrl: this.roundNumber(item.estimatedCostBrl),
        totalInputTokens: Math.round(item.totalInputTokens),
        totalOutputTokens: Math.round(item.totalOutputTokens),
        totalCachedInputTokens: Math.round(item.totalCachedInputTokens),
        totalTokens: Math.round(item.totalTokens),
        totalAudioSeconds: this.roundNumber(item.totalAudioSeconds),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private serializeEvent(event: any) {
    return {
      id: event.id,
      provider: event.provider,
      action: event.action,
      modelName: event.model_name,
      referenceType: event.reference_type,
      referenceId: event.reference_id,
      newsId: event.news_id,
      quizId: event.quiz_id,
      whatsappMessageId: event.whatsapp_message_id,
      student: event.student
        ? {
            id: event.student.id,
            fullName: event.student.full_name,
            whatsappNumber: event.student.whatsapp_number,
            englishLevel: event.student.english_level,
          }
        : null,
      inputTokens: event.input_tokens,
      outputTokens: event.output_tokens,
      cachedInputTokens: event.cached_input_tokens,
      totalTokens: event.total_tokens,
      audioSeconds: event.audio_seconds,
      quantity: event.quantity,
      unit: event.unit,
      estimatedCostUsd: this.roundNumber(Number(event.estimated_cost_usd || 0)),
      estimatedCostBrl: this.roundNumber(Number(event.estimated_cost_brl || 0)),
      metadata: event.metadata,
      createdAt: event.created_at,
    };
  }

  private sumCostFields(events: Array<any>) {
    const usd = this.roundNumber(
      events.reduce((total, event) => total + Number(event.estimated_cost_usd || 0), 0),
    );
    const brl = this.roundNumber(
      events.reduce((total, event) => total + Number(event.estimated_cost_brl || 0), 0),
    );

    return { usd, brl };
  }

  private sumNumber(events: Array<any>, field: string) {
    return events.reduce((total, event) => total + Number(event[field] || 0), 0);
  }

  private roundNumber(value: number) {
    return Number(value.toFixed(6));
  }

  private normalizeLimit(value: number | undefined, fallback: number) {
    if (!value || !Number.isFinite(value)) {
      return fallback;
    }

    return Math.min(Math.max(Math.trunc(value), 1), 500);
  }
}

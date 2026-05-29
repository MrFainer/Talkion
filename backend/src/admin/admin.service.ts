import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listTeachers(fromStr?: string, toStr?: string) {
    let fromDate: Date;
    let toDate: Date;

    const now = new Date();
    if (fromStr) {
      fromDate = new Date(fromStr);
    } else {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1); // 1st day of current month
    }

    if (toStr) {
      toDate = new Date(toStr);
      toDate.setHours(23, 59, 59, 999);
    } else {
      toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999); // last day of current month
    }

    const teachers = await this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        credit_balance: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    const teacherIds = teachers.map((t: any) => t.id);
    const costs = await this.prisma.usageCostEvent.groupBy({
      by: ['teacher_id'],
      where: { 
        teacher_id: { in: teacherIds },
        created_at: {
          gte: fromDate,
          lte: toDate,
        }
      },
      _sum: {
        total_tokens: true,
        input_tokens: true,
        output_tokens: true,
        cached_input_tokens: true,
        audio_seconds: true,
      },
    });

    const ttsCosts = await this.prisma.usageCostEvent.groupBy({
      by: ['teacher_id'],
      where: {
        teacher_id: { in: teacherIds },
        action: 'NEWS_TTS_GENERATION',
        created_at: {
          gte: fromDate,
          lte: toDate,
        },
      },
      _sum: {
        quantity: true,
      },
    });

    const costMap = new Map(costs.map((c: any) => [c.teacher_id, c._sum]));
    const ttsMap = new Map(ttsCosts.map((c: any) => [c.teacher_id, c._sum]));

    return {
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      data: teachers.map((teacher: any) => {
        const stats = costMap.get(teacher.id) || { total_tokens: 0, input_tokens: 0, output_tokens: 0, cached_input_tokens: 0, audio_seconds: 0 };
        const ttsStats = ttsMap.get(teacher.id) || { quantity: 0 };
        return {
          ...teacher,
          totalTokens: stats.total_tokens || 0,
          inputTokens: stats.input_tokens || 0,
          outputTokens: stats.output_tokens || 0,
          cachedTokens: stats.cached_input_tokens || 0,
          audioSeconds: stats.audio_seconds || 0,
          ttsCharacters: ttsStats.quantity || 0,
          creditBalance: teacher.credit_balance || 0,
        };
      })
    };
  }

  async toggleTeacherStatus(teacherId: string) {
    const teacher = await this.prisma.user.findUnique({ where: { id: teacherId } });
    if (!teacher) {
      throw new NotFoundException('Professor não encontrado.');
    }

    const updated = await this.prisma.user.update({
      where: { id: teacherId },
      data: { active: !teacher.active },
      select: {
        id: true,
        name: true,
        active: true,
      },
    });

    return updated;
  }

  async updateTeacherCredits(teacherId: string, creditBalance: number) {
    const teacher = await this.prisma.user.findUnique({ where: { id: teacherId } });
    if (!teacher) {
      throw new NotFoundException('Professor não encontrado.');
    }

    const updated = await this.prisma.user.update({
      where: { id: teacherId },
      data: { credit_balance: creditBalance },
      select: {
        id: true,
        name: true,
        email: true,
        credit_balance: true,
      },
    });

    return updated;
  }
}

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';

type AgendaItem = {
  lessonId: string;
  studentId: string;
  studentName: string;
  whatsappNumber: string;
  kind: 'RECURRING' | 'EXTRA';
  time: string;
  date: string;
  status: 'PENDING' | 'CONFIRMED' | 'DECLINED';
  confirmationId: string | null;
  source: string | null;
};

@Injectable()
export class LessonsService {
  private readonly logger = new Logger(LessonsService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM, {
    timeZone: process.env.NEWS_DAILY_TIMEZONE || 'America/Sao_Paulo',
  })
  async cleanupExtraLessons() {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const deleted = await this.prisma.lesson.deleteMany({
      where: {
        kind: 'EXTRA',
        date: { lt: startOfDay },
      },
    });
    if (deleted.count > 0) {
      this.logger.log(`[LESSONS] Aulas extras removidas: ${deleted.count}`);
    }
  }

  async listStudentLessons(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true },
    });
    if (!student) {
      throw new NotFoundException('Aluno não encontrado.');
    }

    const lessons = await this.prisma.lesson.findMany({
      where: { student_id: studentId },
      orderBy: [{ kind: 'asc' as any }, { weekday: 'asc' as any }, { date: 'asc' as any }, { time: 'asc' as any }],
    });

    return lessons;
  }

  private parseDateInput(date?: string) {
    if (!date) return null;
    const trimmed = String(date).trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      throw new BadRequestException('date must be in YYYY-MM-DD format');
    }
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const d = new Date(year, month, day);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    return d;
  }

  private getDayRange(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  async getAgenda(teacherId: string, date?: string) {
    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
      select: { id: true, role: true, active: true },
    });
    if (!teacher || !teacher.active) {
      throw new BadRequestException('Usuário inválido ou inativo.');
    }

    const day = this.parseDateInput(date) || new Date();
    const { start, end } = this.getDayRange(day);
    const weekday = day.getDay();

    const lessons = await this.prisma.lesson.findMany({
      where: {
        student: { teacher_id: teacherId },
        OR: [
          { kind: 'RECURRING', recurring: true, weekday },
          { kind: 'EXTRA', date: { gte: start, lte: end } },
        ],
      },
      include: {
        student: {
          select: {
            id: true,
            full_name: true,
            whatsapp_number: true,
            active: true,
            whatsapp_valid: true,
          },
        },
      },
      orderBy: [{ time: 'asc' }],
    });

    const lessonIds = lessons.map((l) => l.id);
    const occurrenceDate = new Date(start);

    const confirmations = lessonIds.length
      ? await this.prisma.lessonConfirmation.findMany({
          where: {
            lesson_id: { in: lessonIds },
            occurrence_date: occurrenceDate,
          },
          select: { id: true, lesson_id: true, status: true, source: true },
        })
      : [];

    const byLessonId = new Map<string, { id: string; status: any; source: string | null }>();
    for (const c of confirmations) {
      byLessonId.set(c.lesson_id, { id: c.id, status: c.status, source: c.source });
    }

    const items: AgendaItem[] = lessons
      .filter((l) => l.student?.active !== false)
      .map((lesson) => {
        const confirmation = byLessonId.get(lesson.id) || null;
        const status = confirmation?.status || 'PENDING';
        return {
          lessonId: lesson.id,
          studentId: lesson.student.id,
          studentName: lesson.student.full_name,
          whatsappNumber: lesson.student.whatsapp_number,
          kind: lesson.kind as any,
          time: lesson.time,
          date: start.toISOString().slice(0, 10),
          status,
          confirmationId: confirmation?.id || null,
          source: confirmation?.source || null,
        };
      })
      .sort((a, b) => (a.time === b.time ? a.studentName.localeCompare(b.studentName) : a.time.localeCompare(b.time)));

    return { date: start.toISOString().slice(0, 10), items };
  }

  private normalizeTime(value: unknown) {
    const str = String(value || '').trim();
    if (!/^\d{2}:\d{2}$/.test(str)) {
      throw new BadRequestException('time must be in HH:MM format');
    }
    return str;
  }

  async createLesson(studentId: string, body: any) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true },
    });
    if (!student) {
      throw new NotFoundException('Aluno não encontrado.');
    }

    const kind = String(body?.kind || 'RECURRING').trim().toUpperCase();
    const time = this.normalizeTime(body?.time);

    if (kind === 'EXTRA') {
      const dateObj = this.parseDateInput(String(body?.date || '').trim());
      if (!dateObj) {
        throw new BadRequestException('date is required for EXTRA lesson');
      }
      const { start } = this.getDayRange(dateObj);
      return this.prisma.lesson.create({
        data: {
          student_id: studentId,
          kind: 'EXTRA',
          recurring: false,
          date: start,
          time,
        },
      });
    }

    const weekdayRaw = Number(body?.weekday);
    if (!Number.isInteger(weekdayRaw) || weekdayRaw < 0 || weekdayRaw > 6) {
      throw new BadRequestException('weekday must be between 0 (Sunday) and 6 (Saturday)');
    }

    return this.prisma.lesson.create({
      data: {
        student_id: studentId,
        kind: 'RECURRING',
        weekday: weekdayRaw,
        recurring: Boolean(body?.recurring ?? true),
        time,
      },
    });
  }

  async updateLesson(lessonId: string, body: any) {
    const existing = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, kind: true },
    });
    if (!existing) {
      throw new NotFoundException('Aula não encontrada.');
    }

    const data: any = {};
    if (body?.time !== undefined) {
      data.time = this.normalizeTime(body?.time);
    }

    if (existing.kind === 'RECURRING') {
      if (body?.weekday !== undefined) {
        const weekdayRaw = Number(body?.weekday);
        if (!Number.isInteger(weekdayRaw) || weekdayRaw < 0 || weekdayRaw > 6) {
          throw new BadRequestException('weekday must be between 0 and 6');
        }
        data.weekday = weekdayRaw;
      }
      if (body?.recurring !== undefined) {
        data.recurring = Boolean(body?.recurring);
      }
    } else {
      if (body?.date !== undefined) {
        const dateObj = this.parseDateInput(String(body?.date || '').trim());
        if (!dateObj) {
          throw new BadRequestException('Invalid date');
        }
        data.date = this.getDayRange(dateObj).start;
      }
    }

    return this.prisma.lesson.update({
      where: { id: lessonId },
      data,
    });
  }

  async deleteLesson(lessonId: string) {
    const existing = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Aula não encontrada.');
    }

    await this.prisma.lesson.delete({ where: { id: lessonId } });
    return { deleted: true };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class TeacherDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(teacherId: string) {
    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
      select: { id: true, name: true, email: true, credit_balance: true },
    });

    if (!teacher) {
      throw new NotFoundException('Professor não encontrado.');
    }

    const [summary, engagement, ranking, pronunciationEvolution] =
      await Promise.all([
        this.getSummary(teacherId),
        this.getEngagement(teacherId),
        this.getWeeklyRanking(teacherId),
        this.getPronunciationEvolution(teacherId),
      ]);

    return {
      teacher: { id: teacher.id, name: teacher.name, email: teacher.email },
      summary,
      engagement,
      ranking,
      pronunciationEvolution,
    };
  }

  private async getSummary(teacherId: string) {
    const [creditResult, correcoesResult, avaliacoesResult, exerciciosResult] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: teacherId },
          select: { credit_balance: true },
        }),
        this.prisma.speakingFeedback.count({
          where: {
            audioSubmission: {
              student: { teacher_id: teacherId },
            },
          },
        }),
        this.prisma.quizAnswer.count({
          where: {
            student: { teacher_id: teacherId },
          },
        }),
        this.prisma.quiz.count({
          where: { teacher_id: teacherId },
        }),
      ]);

    return {
      creditBalance: creditResult?.credit_balance ?? 0,
      totalCorrecoes: correcoesResult,
      totalAvaliacoes: avaliacoesResult,
      totalExerciciosGerados: exerciciosResult,
    };
  }

  private async getEngagement(teacherId: string) {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const todayEnd = new Date(todayStart.getTime() + 86400000 - 1);
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const yesterdayEnd = new Date(todayStart.getTime() - 1);
    const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 86400000);

    const activeStudents = await this.prisma.student.count({
      where: { teacher_id: teacherId, active: true },
    });

    const [todayActiveRaw, yesterdayActiveRaw, last7DaysDaily] =
      await Promise.all([
        this.getActiveStudentsInRange(teacherId, todayStart, todayEnd),
        this.getActiveStudentsInRange(teacherId, yesterdayStart, yesterdayEnd),
        this.getDailyActiveCount(
          teacherId,
          sevenDaysAgo,
          todayEnd,
          activeStudents,
        ),
      ]);

    const todayActive = todayActiveRaw.length;
    const yesterdayActive = yesterdayActiveRaw.length;

    const dailyResponseRate =
      activeStudents > 0 ? Math.round((todayActive / activeStudents) * 100) : 0;
    const yesterdayRate =
      activeStudents > 0
        ? Math.round((yesterdayActive / activeStudents) * 100)
        : 0;

    const consecutiveDays = await this.computeConsecutiveDays(teacherId);

    return {
      dailyResponseRate,
      yesterdayRate,
      dailyRateChange:
        yesterdayRate > 0 ? dailyResponseRate - yesterdayRate : 0,
      last7Days: last7DaysDaily,
      totalActiveStudents: activeStudents,
      todayActiveStudents: todayActive,
      consecutiveDays,
    };
  }

  private async getActiveStudentsInRange(
    teacherId: string,
    from: Date,
    to: Date,
  ) {
    const quizStudents = await this.prisma.quizAnswer.findMany({
      where: {
        created_at: { gte: from, lte: to },
        student: { teacher_id: teacherId },
      },
      select: { student_id: true },
      distinct: ['student_id'],
    });

    const audioStudents = await this.prisma.audioSubmission.findMany({
      where: {
        created_at: { gte: from, lte: to },
        student: { teacher_id: teacherId },
      },
      select: { student_id: true },
      distinct: ['student_id'],
    });

    const lessonStudents = await this.prisma.lessonConfirmation.findMany({
      where: {
        responded_at: { gte: from, lte: to },
        lesson: { student: { teacher_id: teacherId } },
      },
      select: { lesson: { select: { student_id: true } } },
    });

    const ids = new Set<string>();
    quizStudents.forEach((s) => ids.add(s.student_id));
    audioStudents.forEach((s) => ids.add(s.student_id));
    lessonStudents.forEach((s) => ids.add(s.lesson.student_id));

    return Array.from(ids);
  }

  private async getDailyActiveCount(
    teacherId: string,
    from: Date,
    to: Date,
    totalActive: number,
  ) {
    const days: { date: string; active: number; rate: number }[] = [];
    const cursor = new Date(from);

    while (cursor <= to) {
      const dayStart = new Date(cursor);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(23, 59, 59, 999);

      const active = await this.getActiveStudentsInRange(
        teacherId,
        dayStart,
        dayEnd,
      );
      const rate =
        totalActive > 0 ? Math.round((active.length / totalActive) * 100) : 0;

      days.push({
        date: dayStart.toISOString().slice(0, 10),
        active: active.length,
        rate,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }

  private async computeConsecutiveDays(teacherId: string) {
    const students = await this.prisma.student.findMany({
      where: { teacher_id: teacherId, active: true },
      select: { id: true, full_name: true },
    });

    if (students.length === 0) {
      return { classAverage: 0, bestStreaks: [] };
    }

    const streaks: { studentId: string; fullName: string; streak: number }[] =
      [];

    for (const student of students) {
      const [quizDates, audioDates, lessonDates] = await Promise.all([
        this.prisma.quizAnswer.findMany({
          where: { student_id: student.id },
          select: { created_at: true },
          orderBy: { created_at: 'asc' },
        }),
        this.prisma.audioSubmission.findMany({
          where: { student_id: student.id },
          select: { created_at: true },
          orderBy: { created_at: 'asc' },
        }),
        this.prisma.lessonConfirmation.findMany({
          where: {
            lesson: { student_id: student.id },
            responded_at: { not: null },
          },
          select: { responded_at: true },
          orderBy: { responded_at: 'asc' },
        }),
      ]);

      const dateSet = new Set<string>();

      quizDates.forEach((d) => {
        dateSet.add(d.created_at.toISOString().slice(0, 10));
      });
      audioDates.forEach((d) => {
        dateSet.add(d.created_at.toISOString().slice(0, 10));
      });
      lessonDates.forEach((d) => {
        if (d.responded_at) {
          dateSet.add(d.responded_at.toISOString().slice(0, 10));
        }
      });

      const sortedDates = Array.from(dateSet).sort();
      let maxStreak = 0;
      let currentStreak = 1;

      for (let i = 1; i < sortedDates.length; i++) {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        const diffDays = Math.round(
          (curr.getTime() - prev.getTime()) / 86400000,
        );

        if (diffDays === 1) {
          currentStreak++;
        } else {
          maxStreak = Math.max(maxStreak, currentStreak);
          currentStreak = 1;
        }
      }
      maxStreak = Math.max(maxStreak, currentStreak);

      streaks.push({
        studentId: student.id,
        fullName: student.full_name,
        streak: maxStreak,
      });
    }

    streaks.sort((a, b) => b.streak - a.streak);

    const classAverage =
      streaks.length > 0
        ? Math.round(
            streaks.reduce((sum, s) => sum + s.streak, 0) / streaks.length,
          )
        : 0;

    return {
      classAverage,
      bestStreaks: streaks.slice(0, 5),
    };
  }

  private async getWeeklyRanking(teacherId: string) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + mondayOffset,
    );
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000 - 1);

    const students = await this.prisma.student.findMany({
      where: { teacher_id: teacherId, active: true },
      select: { id: true, full_name: true, whatsapp_number: true },
    });

    const ranking: {
      studentId: string;
      fullName: string;
      whatsappNumber: string;
      score: number;
      quizAnswers: number;
      speakingFeedbacks: number;
      lessonConfirmations: number;
    }[] = [];

    for (const student of students) {
      const [quizCount, feedbackCount, lessonCount] = await Promise.all([
        this.prisma.quizAnswer.count({
          where: {
            student_id: student.id,
            created_at: { gte: weekStart, lte: weekEnd },
          },
        }),
        this.prisma.speakingFeedback.count({
          where: {
            audioSubmission: {
              student_id: student.id,
              created_at: { gte: weekStart, lte: weekEnd },
            },
          },
        }),
        this.prisma.lessonConfirmation.count({
          where: {
            lesson: { student_id: student.id },
            responded_at: { gte: weekStart, lte: weekEnd },
            status: 'CONFIRMED',
          },
        }),
      ]);

      const score = quizCount + feedbackCount * 2 + lessonCount * 3;

      ranking.push({
        studentId: student.id,
        fullName: student.full_name,
        whatsappNumber: student.whatsapp_number,
        score,
        quizAnswers: quizCount,
        speakingFeedbacks: feedbackCount,
        lessonConfirmations: lessonCount,
      });
    }

    ranking.sort((a, b) => b.score - a.score);

    return {
      weekStart: weekStart.toISOString().slice(0, 10),
      weekEnd: weekEnd.toISOString().slice(0, 10),
      ranking: ranking.slice(0, 10),
    };
  }

  private async getPronunciationEvolution(teacherId: string) {
    const feedbacks = await this.prisma.speakingFeedback.findMany({
      where: {
        audioSubmission: {
          student: { teacher_id: teacherId },
        },
      },
      select: {
        score: true,
        created_at: true,
        audioSubmission: {
          select: {
            student: { select: { full_name: true } },
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    if (feedbacks.length === 0) {
      return { weekly: [], monthly: [], average: 0, total: 0 };
    }

    const weeklyMap = new Map<string, { scores: number[]; count: number }>();
    const monthlyMap = new Map<string, { scores: number[]; count: number }>();

    for (const fb of feedbacks) {
      const date = new Date(fb.created_at);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().slice(0, 10);

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, { scores: [], count: 0 });
      }
      weeklyMap.get(weekKey)!.scores.push(fb.score);
      weeklyMap.get(weekKey)!.count++;

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { scores: [], count: 0 });
      }
      monthlyMap.get(monthKey)!.scores.push(fb.score);
      monthlyMap.get(monthKey)!.count++;
    }

    const weekly = Array.from(weeklyMap.entries())
      .map(([week, data]) => ({
        period: week,
        averageScore:
          Math.round(
            (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10,
          ) / 10,
        evaluations: data.count,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    const monthly = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        period: month,
        averageScore:
          Math.round(
            (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10,
          ) / 10,
        evaluations: data.count,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    const allScores = feedbacks.map((f) => f.score);
    const average =
      Math.round(
        (allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10,
      ) / 10;

    return {
      weekly,
      monthly,
      average,
      total: feedbacks.length,
    };
  }
}

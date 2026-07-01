import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(teacherId: string) {
    let settings = await this.prisma.messageSettings.findUnique({
      where: { teacher_id: teacherId },
    });

    if (!settings) {
      const defaultPrivateGreeting = 'Good {{period}}, {{nome}}! 🎉🎉';
      const defaultGroupGreeting = 'Good {{period}}! 🎉🎉';
      const defaultSpeakingIntro =
        '*Welcome to the challenge of the day 👊🏻🚀*\n\nCan you read this news out loud and send an audio here?\n\nVocê pode ler esta notícia em voz alta e enviar um áudio aqui?\n\n*Have a wonderful day and let’s speak English with Talkion 😉👍🏻🗣️🇺🇸🇬🇧*';
      const defaultNewsIntro =
        '📰 *Let’s go to today’s news!*\n\n📰 *Vamos para a notícia do dia!*';
      const defaultGroupNewsIntro = defaultNewsIntro;
      const defaultLessonConfirmationIdea =
        'Você pode montar a confirmação de aula com base nesse modelo aqui:\n\nGood {{period}} {{nome}}, how are you doing today? 🎉\n\nI would like to confirm our English Mentoring this {{diasemana}} at {{hora_en}} 🙌🏻\n\nParabéns pelo seu comprometimento e dedicação nos estudos de inglês 🚀🇺🇸\n\nHave an excellent week  🎊';
      const defaultGroupQuizHeader =
        '📝 *Quiz do Dia*\n\n🇺🇸 Let’s check your understanding of the news.\n\nHora de testar sua compreensão da notícia.\nResponda com atenção e envie tudo em uma única mensagem. 🚀';
      const defaultPreviousQuizHeader =
        '🗝️ *Gabarito do Quiz Anterior*\n\nConfira as respostas corretas do quiz anterior:';
      const defaultGroupQuizFooter =
        '📩 Responda enviando `A`, `B`, `C` ou no formato `1A`, `2B`, `3C`.\n\n🍀 Boa sorte!';

      const defaultBirthdayTemplate =
        'Você pode montar a mensagem de aniversário com base nesse modelo aqui:\n\n🎉 *Happy Birthday, {{nome}}!* 🎉\n\nWishing you an amazing day filled with joy, success, and lots of English learning! 🚀🇺🇸\n\nMay this new year of your life bring you incredible opportunities and achievements.\n\nKeep shining and never stop learning! 🌟\n\n*Best wishes from Talkion team!* 🎊';

      settings = await this.prisma.messageSettings.create({
        data: {
          teacher_id: teacherId,
          private_greeting_message: defaultPrivateGreeting,
          speaking_intro_message: defaultSpeakingIntro,
          news_intro_message: defaultNewsIntro,
          group_greeting_message: defaultGroupGreeting,
          group_news_intro_message: defaultGroupNewsIntro,
          group_quiz_header_message: defaultGroupQuizHeader,
          private_greeting_idea: `Você pode montar a saudação inicial com base nesse modelo aqui:\n\n${defaultPrivateGreeting}`,
          private_speaking_intro_idea: `Você pode montar a introdução do desafio de áudio com base nesse modelo aqui:\n\n${defaultSpeakingIntro}`,
          private_news_intro_idea: `Você pode montar a introdução da notícia com base nesse modelo aqui:\n\n${defaultNewsIntro}`,
          private_lesson_confirmation_idea: defaultLessonConfirmationIdea,
          lessons_confirmation_enabled: false,
          weekly_summary_enabled: false,
          group_greeting_idea: `Você pode montar a saudação inicial do grupo com base nesse modelo aqui:\n\n${defaultGroupGreeting}`,
          group_previous_quiz_header_idea: `Você pode montar o cabeçalho do quiz do dia anterior com base nesse modelo aqui:\n\n${defaultPreviousQuizHeader}`,
          group_quiz_header_idea: `Você pode montar o cabeçalho do desafio (quiz) com base nesse modelo aqui:\n\n${defaultGroupQuizHeader}`,
          group_quiz_footer_idea: `Você pode montar o rodapé do quiz com base nesse modelo aqui:\n\n${defaultGroupQuizFooter}`,
          group_news_intro_idea: `Você pode montar a introdução da notícia no grupo com base nesse modelo aqui:\n\n${defaultGroupNewsIntro}`,
          birthday_message_template: defaultBirthdayTemplate,
        },
      });
    } else {
      const updates: Record<string, any> = {};
      const privateGreeting = settings.private_greeting_message || '';
      const speakingIntro = settings.speaking_intro_message || '';
      const newsIntro = settings.news_intro_message || '';
      const groupGreeting = settings.group_greeting_message || '';
      const groupNewsIntro = settings.group_news_intro_message || '';
      const groupQuizHeader = settings.group_quiz_header_message || '';
      const defaultPreviousQuizHeader =
        '🗝️ *Gabarito do Quiz Anterior*\n\nConfira as respostas corretas do quiz anterior:';
      const defaultGroupQuizFooter =
        '📩 Responda enviando `A`, `B`, `C` ou no formato `1A`, `2B`, `3C`.\n\n🍀 Boa sorte!';

      if (!settings.private_greeting_idea) {
        updates.private_greeting_idea = `Você pode montar a saudação inicial com base nesse modelo aqui:\n\n${privateGreeting}`;
      }
      if (!settings.private_speaking_intro_idea) {
        updates.private_speaking_intro_idea = `Você pode montar a introdução do desafio de áudio com base nesse modelo aqui:\n\n${speakingIntro}`;
      }
      if (!settings.private_news_intro_idea) {
        updates.private_news_intro_idea = `Você pode montar a introdução da notícia com base nesse modelo aqui:\n\n${newsIntro}`;
      }
      if (!settings.private_lesson_confirmation_idea) {
        updates.private_lesson_confirmation_idea =
          'Você pode montar a confirmação de aula com base nesse modelo aqui:\n\nGood {{period}} {{nome}}, how are you doing today? 🎉\n\nI would like to confirm our English Mentoring this {{diasemana}} at {{hora_en}} 🙌🏻\n\nParabéns pelo seu comprometimento e dedicação nos estudos de inglês 🚀🇺🇸\n\nHave an excellent week  🎊';
      }
      if (!settings.group_greeting_idea) {
        updates.group_greeting_idea = `Você pode montar a saudação inicial do grupo com base nesse modelo aqui:\n\n${groupGreeting}`;
      }
      if (!settings.group_previous_quiz_header_idea) {
        updates.group_previous_quiz_header_idea = `Você pode montar o cabeçalho do quiz do dia anterior com base nesse modelo aqui:\n\n${defaultPreviousQuizHeader}`;
      }
      if (!settings.group_quiz_header_idea) {
        updates.group_quiz_header_idea = `Você pode montar o cabeçalho do desafio (quiz) com base nesse modelo aqui:\n\n${groupQuizHeader}`;
      }
      if (!settings.group_quiz_footer_idea) {
        const quizFooterModel =
          settings.group_quiz_footer_message || defaultGroupQuizFooter;
        updates.group_quiz_footer_idea = `Você pode montar o rodapé do quiz com base nesse modelo aqui:\n\n${quizFooterModel}`;
      }
      if (!settings.group_news_intro_idea) {
        updates.group_news_intro_idea = `Você pode montar a introdução da notícia no grupo com base nesse modelo aqui:\n\n${groupNewsIntro}`;
      }

      if (Object.keys(updates).length > 0) {
        settings = await this.prisma.messageSettings.update({
          where: { teacher_id: teacherId },
          data: updates,
        });
      }
    }

    return settings;
  }

  async updateSettings(
    teacherId: string,
    dto: UpdateSettingsDto,
    changedBy?: string,
  ) {
    const oldSettings = await this.getSettings(teacherId);

    const newSettings = await this.prisma.messageSettings.update({
      where: { teacher_id: teacherId },
      data: {
        ...dto,
      },
    });

    // Save history
    await this.prisma.messageSettingsHistory.create({
      data: {
        teacher_id: teacherId,
        previous_settings: oldSettings as any,
        new_settings: newSettings as any,
        changed_by: changedBy || teacherId,
      },
    });

    return newSettings;
  }

  async resetSettings(teacherId: string, changedBy?: string) {
    const oldSettings = await this.getSettings(teacherId);

    // Delete current to trigger default values on next fetch/create
    await this.prisma.messageSettings.delete({
      where: { teacher_id: teacherId },
    });

    const newSettings = await this.getSettings(teacherId);

    // Save history
    await this.prisma.messageSettingsHistory.create({
      data: {
        teacher_id: teacherId,
        previous_settings: oldSettings as any,
        new_settings: newSettings as any,
        changed_by: changedBy || teacherId,
      },
    });

    return newSettings;
  }
}

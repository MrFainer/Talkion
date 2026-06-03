import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { NewsModule } from './news/news.module';
import { QuizModule } from './quiz/quiz.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { AiModule } from './ai/ai.module';
import { PrismaModule } from './prisma/prisma.module';
import { BillingModule } from './billing/billing.module';
import { AdminModule } from './admin/admin.module';
import { ScheduleModule } from '@nestjs/schedule';
import { StudentsModule } from './students/students.module';
import { SettingsModule } from './settings/settings.module';
import { LessonsModule } from './lessons/lessons.module';
import { TeacherDashboardModule } from './teacher-dashboard/teacher-dashboard.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { CreditsModule } from './credits/credits.module';
import { ContactModule } from './contact/contact.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    NewsModule,
    QuizModule,
    WhatsappModule,
    AiModule,
    PrismaModule,
    BillingModule,
    AdminModule,
    StudentsModule,
    SettingsModule,
    LessonsModule,
    TeacherDashboardModule,
    SubscriptionsModule,
    CreditsModule,
    ContactModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

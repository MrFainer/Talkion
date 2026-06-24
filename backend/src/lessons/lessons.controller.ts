import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { LessonsService } from './lessons.service';

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get('teacher/:teacherId/agenda')
  async getAgenda(
    @Param('teacherId') teacherId: string,
    @Query('date') date?: string,
  ) {
    if (!teacherId) {
      throw new BadRequestException('teacherId is required');
    }
    return this.lessonsService.getAgenda(teacherId, date);
  }

  @Get('student/:studentId')
  async listStudentLessons(@Param('studentId') studentId: string) {
    if (!studentId) {
      throw new BadRequestException('studentId is required');
    }
    return this.lessonsService.listStudentLessons(studentId);
  }

  @Post('student/:studentId')
  async createLesson(@Param('studentId') studentId: string, @Body() body: any) {
    if (!studentId) {
      throw new BadRequestException('studentId is required');
    }
    return this.lessonsService.createLesson(studentId, body);
  }

  @Patch(':lessonId')
  async updateLesson(@Param('lessonId') lessonId: string, @Body() body: any) {
    if (!lessonId) {
      throw new BadRequestException('lessonId is required');
    }
    return this.lessonsService.updateLesson(lessonId, body);
  }

  @Delete(':lessonId')
  async deleteLesson(@Param('lessonId') lessonId: string) {
    if (!lessonId) {
      throw new BadRequestException('lessonId is required');
    }
    return this.lessonsService.deleteLesson(lessonId);
  }
}

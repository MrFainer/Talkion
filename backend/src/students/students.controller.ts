import { Controller, Get, Post, Patch, Delete, Body, Param, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StudentsService } from './students.service';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get('teacher/:teacherId')
  async list(@Param('teacherId') teacherId: string) {
    return this.studentsService.list(teacherId);
  }

  @Post('teacher/:teacherId')
  async create(@Param('teacherId') teacherId: string, @Body() body: any) {
    return this.studentsService.create(teacherId, body);
  }

  @Post('teacher/:teacherId/import')
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(
    @Param('teacherId') teacherId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }
    return this.studentsService.importExcel(teacherId, file);
  }

  @Patch('teacher/:teacherId/:studentId/toggle')
  async toggle(@Param('teacherId') teacherId: string, @Param('studentId') studentId: string) {
    return this.studentsService.toggleActive(teacherId, studentId);
  }

  @Patch('teacher/:teacherId/:studentId/toggle-private')
  async togglePrivateNews(@Param('teacherId') teacherId: string, @Param('studentId') studentId: string) {
    return this.studentsService.togglePrivateNews(teacherId, studentId);
  }

  @Patch('teacher/:teacherId/:studentId/level')
  async updateLevel(
    @Param('teacherId') teacherId: string, 
    @Param('studentId') studentId: string,
    @Body('level') level: string
  ) {
    return this.studentsService.updateLevel(teacherId, studentId, level);
  }

  @Patch('teacher/:teacherId/:studentId/number')
  async updateNumber(
    @Param('teacherId') teacherId: string, 
    @Param('studentId') studentId: string,
    @Body('whatsappNumber') whatsappNumber: string
  ) {
    return this.studentsService.updateNumber(teacherId, studentId, whatsappNumber);
  }

  @Post('teacher/:teacherId/:studentId/validate-number')
  async validateNumber(
    @Param('teacherId') teacherId: string, 
    @Param('studentId') studentId: string
  ) {
    return this.studentsService.validateNumber(teacherId, studentId);
  }

  @Delete('teacher/:teacherId/:studentId')
  async remove(
    @Param('teacherId') teacherId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.studentsService.remove(teacherId, studentId);
  }
}

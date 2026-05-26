import { Module } from '@nestjs/common';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [LessonsController],
  providers: [LessonsService, PrismaService],
  exports: [LessonsService],
})
export class LessonsModule {}


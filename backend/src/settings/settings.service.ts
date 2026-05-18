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
      settings = await this.prisma.messageSettings.create({
        data: { teacher_id: teacherId },
      });
    }

    return settings;
  }

  async updateSettings(teacherId: string, dto: UpdateSettingsDto, changedBy?: string) {
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

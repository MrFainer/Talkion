import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('message-settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get(':teacherId')
  getSettings(@Param('teacherId') teacherId: string) {
    return this.settingsService.getSettings(teacherId);
  }

  @Put(':teacherId')
  updateSettings(
    @Param('teacherId') teacherId: string,
    @Body() updateSettingsDto: UpdateSettingsDto,
  ) {
    return this.settingsService.updateSettings(teacherId, updateSettingsDto);
  }

  @Post(':teacherId/reset')
  resetSettings(@Param('teacherId') teacherId: string) {
    return this.settingsService.resetSettings(teacherId);
  }
}

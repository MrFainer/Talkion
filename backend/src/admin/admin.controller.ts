import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from '../auth/admin.guard';

@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async listTeachers(@Query('from') from?: string, @Query('to') to?: string) {
    return this.adminService.listTeachers(from, to);
  }

  @Get('affiliates')
  async listAffiliates() {
    return this.adminService.listAffiliates();
  }

  @Get('site-visits')
  async listSiteVisits(@Query('from') from?: string, @Query('to') to?: string) {
    return this.adminService.listSiteVisits(from, to);
  }

  @Patch('users/:id/toggle')
  async toggleTeacherStatus(@Param('id') id: string) {
    return this.adminService.toggleTeacherStatus(id);
  }

  @Patch('users/:id/plan')
  async updateTeacherPlan(
    @Param('id') id: string,
    @Body() body: { planId: string },
  ) {
    if (!body.planId) throw new BadRequestException('planId é obrigatório');
    return this.adminService.updateTeacherPlan(id, body.planId);
  }

  @Patch('users/:id/credits')
  async updateCredits(
    @Param('id') id: string,
    @Body()
    body: { amount: number; mode?: 'set' | 'add'; description?: string },
  ) {
    if (body.amount == null || body.amount < 0) {
      throw new BadRequestException('amount é obrigatório e deve ser >= 0');
    }
    return this.adminService.updateTeacherCredits(
      id,
      body.amount,
      body.mode || 'set',
      body.description,
    );
  }

  @Delete('users/:id')
  async deleteUser(
    @Param('id') id: string,
    @Req() request: { user?: { sub?: string } },
  ) {
    return this.adminService.deleteUser(id, request.user?.sub);
  }
}

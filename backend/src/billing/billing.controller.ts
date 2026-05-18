import { Controller, Get, Param, Query } from '@nestjs/common';
import { BillingService, BillingFilters } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('teacher/:teacherId/dashboard')
  async getDashboard(
    @Param('teacherId') teacherId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const filters: BillingFilters = { teacherId, from, to };
    return this.billingService.getTeacherDashboard(filters);
  }

  @Get('teacher/:teacherId/events')
  async getEvents(
    @Param('teacherId') teacherId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const filters: BillingFilters = {
      teacherId,
      from,
      to,
      limit: limit ? parseInt(limit, 10) : undefined,
    };
    return this.billingService.getTeacherEvents(filters);
  }

  @Get('teacher/:teacherId/students')
  async getStudentBreakdown(
    @Param('teacherId') teacherId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const filters: BillingFilters = { teacherId, from, to };
    return this.billingService.getTeacherStudentBreakdown(filters);
  }

  @Get('teacher/:teacherId/actions')
  async getActionBreakdown(
    @Param('teacherId') teacherId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const filters: BillingFilters = { teacherId, from, to };
    return this.billingService.getTeacherActionBreakdown(filters);
  }
}

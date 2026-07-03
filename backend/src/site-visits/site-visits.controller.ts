import { Body, Controller, Headers, Ip, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SiteVisitsService } from './site-visits.service';

type TrackVisitBody = {
  pageType: 'HOME' | 'LOGIN' | 'REGISTER';
  path: string;
  fullUrl?: string;
  referralCode?: string;
  referrerUrl?: string;
  userAgent?: string;
  platform?: string;
  language?: string;
  screenWidth?: number;
  screenHeight?: number;
  timezone?: string;
};

@Controller('site-visits')
export class SiteVisitsController {
  constructor(private readonly siteVisitsService: SiteVisitsService) {}

  @Post('track')
  async trackVisit(
    @Body() body: TrackVisitBody,
    @Headers('referer') refererHeader: string | undefined,
    @Ip() ip: string | undefined,
    @Req() req: Request,
  ) {
    const forwardedFor = req.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : String(forwardedFor || '')
          .split(',')[0]
          ?.trim();

    return this.siteVisitsService.trackVisit({
      pageType: body.pageType,
      path: body.path,
      fullUrl: body.fullUrl,
      referralCode: body.referralCode,
      referrerUrl: body.referrerUrl,
      userAgent: body.userAgent || req.headers['user-agent'],
      refererHeader,
      ipAddress: forwardedIp || ip,
      platform: body.platform,
      language: body.language,
      screenWidth: body.screenWidth,
      screenHeight: body.screenHeight,
      timezone: body.timezone,
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type TrackVisitInput = {
  pageType: 'HOME' | 'LOGIN' | 'REGISTER';
  path: string;
  fullUrl?: string | null;
  referralCode?: string | null;
  referrerUrl?: string | null;
  userAgent?: string | null;
  refererHeader?: string | null;
  ipAddress?: string | null;
  platform?: string | null;
  language?: string | null;
  screenWidth?: number | null;
  screenHeight?: number | null;
  timezone?: string | null;
};

@Injectable()
export class SiteVisitsService {
  constructor(private readonly prisma: PrismaService) {}

  async trackVisit(input: TrackVisitInput) {
    const ua = String(input.userAgent || '').trim();
    const sourceType = input.referralCode ? 'REFERRAL_LINK' : 'DIRECT';

    return this.prisma.siteVisit.create({
      data: {
        page_type: input.pageType,
        source_type: sourceType,
        path: input.path || '/',
        full_url: this.normalizeText(input.fullUrl),
        referral_code: this.normalizeText(input.referralCode),
        referrer_url: this.normalizeText(input.referrerUrl),
        referer_header: this.normalizeText(input.refererHeader),
        ip_address: this.normalizeText(input.ipAddress),
        user_agent: this.normalizeText(ua),
        browser_name: this.detectBrowser(ua),
        os_name: this.detectOS(ua),
        device_type: this.detectDeviceType(ua),
        device_vendor: this.detectDeviceVendor(ua),
        device_model: this.detectDeviceModel(ua),
        platform: this.normalizeText(input.platform),
        language: this.normalizeText(input.language),
        screen_width: this.normalizeNumber(input.screenWidth),
        screen_height: this.normalizeNumber(input.screenHeight),
        timezone: this.normalizeText(input.timezone),
      },
    });
  }

  private normalizeText(value: string | null | undefined) {
    const normalized = String(value || '').trim();
    return normalized ? normalized : null;
  }

  private normalizeNumber(value: number | null | undefined) {
    return Number.isFinite(value) ? Number(value) : null;
  }

  private detectBrowser(userAgent: string) {
    const ua = userAgent.toLowerCase();
    if (!ua) return null;
    if (ua.includes('edg/')) return 'Edge';
    if (ua.includes('opr/') || ua.includes('opera')) return 'Opera';
    if (ua.includes('chrome/') && !ua.includes('edg/')) return 'Chrome';
    if (ua.includes('firefox/')) return 'Firefox';
    if (ua.includes('safari/') && !ua.includes('chrome/')) return 'Safari';
    return 'Desconhecido';
  }

  private detectOS(userAgent: string) {
    const ua = userAgent.toLowerCase();
    if (!ua) return null;
    if (ua.includes('windows')) return 'Windows';
    if (ua.includes('android')) return 'Android';
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'iOS';
    if (ua.includes('mac os x') || ua.includes('macintosh')) return 'macOS';
    if (ua.includes('linux')) return 'Linux';
    return 'Desconhecido';
  }

  private detectDeviceType(userAgent: string) {
    const ua = userAgent.toLowerCase();
    if (!ua) return null;
    if (ua.includes('tablet') || ua.includes('ipad')) return 'Tablet';
    if (
      ua.includes('mobile') ||
      ua.includes('android') ||
      ua.includes('iphone')
    ) {
      return 'Celular';
    }
    return 'Desktop';
  }

  private detectDeviceVendor(userAgent: string) {
    const ua = userAgent.toLowerCase();
    if (!ua) return null;
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('macintosh')) return 'Apple';
    if (ua.includes('samsung')) return 'Samsung';
    if (ua.includes('huawei')) return 'Huawei';
    if (ua.includes('xiaomi')) return 'Xiaomi';
    if (ua.includes('motorola') || ua.includes('moto')) return 'Motorola';
    return null;
  }

  private detectDeviceModel(userAgent: string) {
    const ua = userAgent.toLowerCase();
    if (!ua) return null;
    if (ua.includes('iphone')) return 'iPhone';
    if (ua.includes('ipad')) return 'iPad';
    if (ua.includes('macintosh')) return 'Mac';
    if (ua.includes('windows')) return 'PC Windows';
    if (ua.includes('android')) return 'Android';
    return null;
  }
}

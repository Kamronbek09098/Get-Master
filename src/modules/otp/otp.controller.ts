import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { OtpPurpose } from '@prisma/client';
import { panelOf } from '../../common/utils/panel';
import { OtpService } from './otp.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { VerifyOTPDto } from './dto/verify-otp.dto';

@Controller('otp')
export class OtpController {
  constructor(private readonly otp: OtpService) {}

  @Public()
  @RateLimit({ policy: 'otpRequest', scope: 'ip+phone' })
  @Post('request')
  request(@Body() dto: RequestOtpDto, @Req() req: Request) {
    return this.otp.issue(dto.phone, OtpPurpose.PHONE_VERIFICATION, undefined, {
      ip: this.clientIp(req),
      panel: panelOf(req),
    });
  }

  @Public()
  @RateLimit({ policy: 'otpVerify', scope: 'ip+phone' })
  @Post('verify')
  async verify(@Body() dto: VerifyOTPDto) {
    await this.otp.verify(dto.phone, OtpPurpose.PHONE_VERIFICATION, dto.code);
    return { verified: true };
  }

  private clientIp(req: Request) {
    const forwarded = req.headers['x-forwarded-for'];
    const candidate = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(',')[0];
    return (candidate || req.ip || '').slice(0, 64) || undefined;
  }
}

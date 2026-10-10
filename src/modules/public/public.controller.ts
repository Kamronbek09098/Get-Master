import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { PublicMasterQueryDto, PublicServiceQueryDto } from './dto/public-master-query.dto';
import { SubscriptionService } from '../subscription/subscription.service';
import { PublicService } from './public.service';

/** Kirmasdan ko‘rinadigan ommaviy ma’lumotlar (katalog, statistika). Telefon va aniq manzil hech qachon berilmaydi. */
@Controller('public')
export class PublicController {
  constructor(
    private readonly publicService: PublicService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  @Public()
  @RateLimit({ scope: 'ip', limit: 90, windowSeconds: 60 })
  @Get('masters')
  masters(@Query() query: PublicMasterQueryDto) {
    return this.publicService.masters(query);
  }

  @Public()
  @RateLimit({ scope: 'ip', limit: 60, windowSeconds: 60 })
  @Get('regions')
  regions() {
    return this.publicService.regions();
  }

  @Public()
  @RateLimit({ scope: 'ip', limit: 30, windowSeconds: 60 })
  @Get('stats')
  stats() {
    return this.publicService.stats();
  }

  @Public()
  @RateLimit({ scope: 'ip', limit: 90, windowSeconds: 60 })
  @Get('services')
  services(@Query() query: PublicServiceQueryDto) {
    return this.publicService.services(query);
  }

  @Public()
  @RateLimit({ scope: 'ip', limit: 30, windowSeconds: 60 })
  @Get('prices')
  prices() {
    return this.publicService.prices();
  }

  /** Obuna rejalari va narxlari (narxlar sahifasi uchun). */
  @Public()
  @RateLimit({ scope: 'ip', limit: 30, windowSeconds: 60 })
  @Get('plans')
  plans() {
    return this.subscriptions.plans();
  }
}

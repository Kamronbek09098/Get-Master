import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { Body, Controller, Get, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Idempotent } from '../../common/decorators/idempotent.decorator';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { OfferService } from './offer.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OfferQueryDto } from './dto/offer-query.dto';

@Controller()
export class OfferController {
  constructor(private readonly offerService: OfferService) {}

  @Post('offers')
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateOfferDto) {
    return this.offerService.create(userId, dto);
  }

  @Get('offers/mine')
  @Roles(Role.MASTER)
  findAll(@CurrentUser('sub') userId: string, @Query() query: OfferQueryDto) {
    return this.offerService.findAll(userId, query);
  }

  @Get('offers/:id')
  findOne(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.offerService.findOne(userId, id);
  }

  @Get('problem-requests/:id/offers')
  @Roles(Role.CUSTOMER)
  findAllByRequest(
    @CurrentUser('sub') customerId: string,
    @Param('id', ParseUUIDPipe) requestId: string,
    @Query() query: OfferQueryDto,
  ) {
    return this.offerService.findAllByRequest(customerId, requestId, query);
  }

  @Post('offers/:id/withdraw')
  withdraw(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.offerService.withdraw(userId, id);
  }

  @Post('offers/:id/accept')
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  accept(@CurrentUser('sub') customerId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.offerService.accept(customerId, id);
  }
}

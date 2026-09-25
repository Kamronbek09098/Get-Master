import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, Req, UseInterceptors } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentProvider, Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Idempotent } from '../../common/decorators/idempotent.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { EarningsQueryDto } from './dto/earnings-query.dto';
import { PaymentHistoryQueryDto } from './dto/payment-history-query.dto';

@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('payments')
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  create(@CurrentUser('sub') customerId: string, @Body() dto: CreatePaymentDto) {
    return this.paymentService.create(customerId, dto);
  }

  @Get('payments/history')
  findHistory(@CurrentUser('sub') customerId: string, @Query() query: PaymentHistoryQueryDto) {
    return this.paymentService.findHistory(customerId, query);
  }

  @Get('payments/earnings')
  @Roles(Role.MASTER)
  findEarnings(@CurrentUser('sub') userId: string, @Query() query: EarningsQueryDto) {
    return this.paymentService.findEarnings(userId, query);
  }

  @Get('payments/:id')
  findOne(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.paymentService.findOne(userId, id);
  }

  @Post('payments/:id/refund')
  @Roles(Role.ADMIN)
  @Idempotent()
  @UseInterceptors(IdempotencyInterceptor)
  refund(
    @CurrentUser('sub') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRefundDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.paymentService.refund(actorId, id, dto, idempotencyKey);
  }

  @Public()
  @Post('webhooks/payments/:provider')
  webhook(
    @Param('provider') provider: string,
    @Body() payload: any,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-webhook-signature') signature: string,
  ) {
    const normalizedProvider = provider.toUpperCase() as PaymentProvider;
    return this.paymentService.handleWebhook(
      normalizedProvider,
      payload,
      req.rawBody ?? Buffer.from(JSON.stringify(payload)),
      signature,
    );
  }
}

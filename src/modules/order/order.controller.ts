import { ConfirmCompletionDto } from './dto/confirm-completion.dto';
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { panelOf } from '../../common/utils/panel';
import { OrderService } from './order.service';
import { DirectOrderService } from './direct-order.service';
import { CreateDirectOrderDto } from './dto/create-direct-order.dto';
import { CreateWorkProofDto } from './dto/create-work-proof.dto';
import { ReasonDto } from './dto/reason.dto';
import { OrderHistoryQueryDto } from './dto/order-history-query.dto';

@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly directOrders: DirectOrderService,
  ) {}

  /** Suhbat ichidan ustaga buyurtma yuborish (mijoz). */
  @Post('direct')
  createDirect(@CurrentUser('sub') userId: string, @Body() dto: CreateDirectOrderDto) {
    return this.directOrders.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser('sub') userId: string, @Req() req: Request) {
    return this.orderService.findAll(userId, panelOf(req));
  }

  @Get('history')
  findHistory(@CurrentUser('sub') userId: string, @Query() query: OrderHistoryQueryDto) {
    return this.orderService.findHistory(userId, query);
  }

  @Get(':id')
  findOne(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.orderService.findOne(userId, id, panelOf(req));
  }

  @Post(':id/confirm')
  confirm(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.orderService.confirm(userId, id, panelOf(req));
  }

  @Post(':id/start-travel')
  startTravel(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.orderService.startTravel(userId, id, panelOf(req));
  }

  @Post(':id/arrive')
  arrive(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.orderService.arrive(userId, id, panelOf(req));
  }

  @Post(':id/work-proofs')
  createWorkProof(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateWorkProofDto,
    @Req() req: Request,
  ) {
    return this.orderService.createWorkProof(userId, id, dto, panelOf(req));
  }

  @Get(':id/work-proofs')
  findAllWorkProofs(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.orderService.findAllWorkProofs(userId, id);
  }

  @Delete(':id/work-proofs/:proofId')
  removeWorkProof(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('proofId', ParseUUIDPipe) proofId: string,
    @Req() req: Request,
  ) {
    return this.orderService.removeWorkProof(userId, id, proofId, panelOf(req));
  }

  @Get(':id/timeline')
  findTimeline(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.orderService.findTimeline(userId, id);
  }

  @Post(':id/start-work')
  startWork(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.orderService.startWork(userId, id, panelOf(req));
  }

  @Post(':id/submit-completion')
  submitCompletion(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.orderService.submitCompletion(userId, id, panelOf(req));
  }

  @Post(':id/confirm-completion')
  confirmCompletion(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Body() dto: ConfirmCompletionDto) {
    return this.orderService.confirmCompletion(userId, id, panelOf(req), dto?.paymentMethod);
  }

  @Post(':id/dispute')
  dispute(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @Req() req: Request,
  ) {
    return this.orderService.dispute(userId, id, dto, panelOf(req));
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @Req() req: Request,
  ) {
    return this.orderService.cancel(userId, id, dto, panelOf(req));
  }
}

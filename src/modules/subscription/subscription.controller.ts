import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RequiresPermission } from '../../common/decorators/permission.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminSubscriptionQueryDto, AttachReceiptDto, GrantSubscriptionDto, RejectSubscriptionDto, RequestSubscriptionDto } from './dto/subscription.dto';
import { SubscriptionService } from './subscription.service';

@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptions: SubscriptionService) {}

  @Get('plans')
  plans() {
    return this.subscriptions.plans();
  }

  @Get('me')
  me(@CurrentUser('sub') userId: string) {
    return this.subscriptions.me(userId);
  }

  @Post('requests')
  @RateLimit({ policy: 'call', scope: 'user' })
  request(@CurrentUser('sub') userId: string, @CurrentUser('roles') roles: Role[], @Body() dto: RequestSubscriptionDto) {
    return this.subscriptions.request(userId, roles, dto);
  }

  @Post('requests/:id/receipt')
  attachReceipt(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AttachReceiptDto) {
    return this.subscriptions.attachReceipt(userId, id, dto.mediaAssetId);
  }

  @Post('requests/:id/cancel')
  cancel(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptions.cancelRequest(userId, id);
  }
}

/** Admin: obuna so‘rovlari, sovg‘a va bekor qilish (SUBSCRIPTIONS huquqi). */
@Controller('admin/subscriptions')
@Roles(Role.ADMIN)
@RequiresPermission('SUBSCRIPTIONS')
export class AdminSubscriptionController {
  constructor(private readonly subscriptions: SubscriptionService) {}

  @Get()
  list(@Query() query: AdminSubscriptionQueryDto) {
    return this.subscriptions.adminList(query);
  }

  @Get('summary')
  summary() {
    return this.subscriptions.adminSummary();
  }

  @Post('grant')
  grant(@CurrentUser('sub') adminId: string, @Body() dto: GrantSubscriptionDto) {
    return this.subscriptions.grant(adminId, dto);
  }

  @Patch(':id/approve')
  approve(@CurrentUser('sub') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptions.approve(adminId, id);
  }

  @Patch(':id/reject')
  reject(@CurrentUser('sub') adminId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectSubscriptionDto) {
    return this.subscriptions.reject(adminId, id, dto.reason);
  }

  @Patch(':id/revoke')
  revoke(@CurrentUser('sub') adminId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectSubscriptionDto) {
    return this.subscriptions.revoke(adminId, id, dto.reason);
  }
}

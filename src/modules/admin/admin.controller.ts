import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminUsersService } from './admin-users.service';
import { AdminPortfolioService } from './admin-portfolio.service';
import { AdminChatService } from './admin-chat.service';
import { AdminBadgesService } from './admin-badges.service';
import { AdminBadgesQueryDto } from './dto/badges-query.dto';
import { AdminOrdersService } from './admin-orders.service';
import { AdminDevopsService } from './admin-devops.service';
import { DevopsQueryDto } from './dto/devops-query.dto';
import { AdminOrderActionDto, AdminOrderQueryDto, AdminOrderResolveDto } from './dto/order-query.dto';
import { AdminConversationQueryDto } from './dto/chat-query.dto';
import { CursorQueryDto } from '../../common/dto/cursor-query.dto';
import { PortfolioQueryDto, ReviewPortfolioDto } from './dto/portfolio-review.dto';
import { DeleteUserDto, RegistrationBlockDto, SetUserPasswordDto, SetUserStatusDto } from './dto/user-action.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { AdminService } from './admin.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { RevenueReportQueryDto } from './dto/revenue-report-query.dto';
import { CustomerQueryDto } from '../customer/dto/customer-query.dto';

@Controller('admin')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly users: AdminUsersService,
    private readonly portfolio: AdminPortfolioService,
    private readonly chats: AdminChatService,
    private readonly badges: AdminBadgesService,
    private readonly orders: AdminOrdersService,
    private readonly devops: AdminDevopsService,
  ) {}

  @Get('devops')
  getDevops(@Query() query: DevopsQueryDto) {
    return this.devops.snapshot(query.window ?? '1h');
  }

  @Get('orders')
  findOrders(@Query() query: AdminOrderQueryDto) {
    return this.orders.findAll(query);
  }

  @Get('orders/summary')
  ordersSummary() {
    return this.orders.summary();
  }

  @Get('orders/:id')
  findOrder(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.findOne(id);
  }

  @Post('orders/:id/cancel')
  cancelOrder(@CurrentUser('sub') adminId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminOrderActionDto) {
    return this.orders.cancel(adminId, id, dto.reason);
  }

  @Post('orders/:id/resolve')
  resolveOrder(@CurrentUser('sub') adminId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminOrderResolveDto) {
    return this.orders.resolve(adminId, id, dto.decision, dto.reason);
  }

  @Get('badges')
  getBadges(@Query() query: AdminBadgesQueryDto) {
    return this.badges.get(query);
  }

  @Get('dashboard')
  getDashboard(@Query() query: DashboardQueryDto) {
    return this.adminService.getDashboard(query);
  }

  @Get('reports')
  getRevenueReport(@Query() query: RevenueReportQueryDto) {
    return this.adminService.getRevenueReport(query);
  }

  @Get('customers')
  findAllCustomers(@Query() query: CustomerQueryDto) {
    return this.adminService.findAllCustomers(query);
  }

  @Get('users')
  findAllUsers(@Query() query: UserQueryDto) {
    return this.users.findAll(query);
  }

  @Get('users/by-number/:number')
  lookupUser(@Param('number', ParseIntPipe) number: number) {
    return this.users.lookupByNumber(number);
  }

  @Get('users/:id')
  findUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.findOne(id);
  }

  @Patch('users/:id/status')
  setUserStatus(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserStatusDto,
    @Req() req: Request,
  ) {
    return this.users.setStatus(adminId, id, dto, req);
  }

  @Post('users/:id/password')
  setUserPassword(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserPasswordDto,
    @Req() req: Request,
  ) {
    return this.users.setPassword(adminId, id, dto, req);
  }

  @Post('users/:id/delete')
  removeUser(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeleteUserDto,
    @Req() req: Request,
  ) {
    return this.users.remove(adminId, id, dto, req);
  }

  @Post('users/:id/registration-block')
  blockRegistration(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrationBlockDto,
    @Req() req: Request,
  ) {
    return this.users.setRegistrationBlock(adminId, id, true, dto, req);
  }

  @Post('users/:id/registration-unblock')
  unblockRegistration(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrationBlockDto,
    @Req() req: Request,
  ) {
    return this.users.setRegistrationBlock(adminId, id, false, dto, req);
  }

  @Get('portfolio')
  findAllPortfolio(@Query() query: PortfolioQueryDto) {
    return this.portfolio.findAll(query);
  }

  @Post('portfolio/:id/review')
  reviewPortfolio(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewPortfolioDto,
  ) {
    return this.portfolio.review(adminId, id, dto);
  }

  @Get('conversations')
  findAllConversations(@Query() query: AdminConversationQueryDto) {
    return this.chats.findAll(query);
  }

  @Get('conversations/:id')
  findConversation(@Param('id', ParseUUIDPipe) id: string) {
    return this.chats.findOne(id);
  }

  @Get('conversations/:id/messages')
  findConversationMessages(@Param('id', ParseUUIDPipe) id: string, @Query() query: CursorQueryDto) {
    return this.chats.findMessages(id, query);
  }
}

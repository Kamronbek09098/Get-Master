import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { NotificationModule } from '../notification/notification.module';
import { AdminUsersService } from './admin-users.service';
import { AdminPortfolioService } from './admin-portfolio.service';
import { AdminChatService } from './admin-chat.service';
import { AdminBadgesService } from './admin-badges.service';
import { AdminOrdersService } from './admin-orders.service';
import { OrderModule } from '../order/order.module';
import { AdminAuditNotifierService } from './admin-audit-notifier.service';

@Module({
  imports: [NotificationModule, OrderModule],
  controllers: [AdminController],
  providers: [AdminService, AdminUsersService, AdminPortfolioService, AdminChatService, AdminBadgesService, AdminAuditNotifierService, AdminOrdersService],
})
export class AdminModule {}

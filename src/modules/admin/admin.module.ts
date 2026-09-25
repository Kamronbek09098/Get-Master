import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { NotificationModule } from '../notification/notification.module';
import { AdminUsersService } from './admin-users.service';
import { AdminPortfolioService } from './admin-portfolio.service';
import { AdminChatService } from './admin-chat.service';
import { AdminBadgesService } from './admin-badges.service';
import { AdminAuditNotifierService } from './admin-audit-notifier.service';

@Module({
  imports: [NotificationModule],
  controllers: [AdminController],
  providers: [AdminService, AdminUsersService, AdminPortfolioService, AdminChatService, AdminBadgesService, AdminAuditNotifierService],
})
export class AdminModule {}

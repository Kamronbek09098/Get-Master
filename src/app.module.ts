import { TelegramModule } from './infrastructure/telegram/telegram.module';
import { SmsModule } from './infrastructure/sms/sms.module';
import telegramConfig from './config/telegram.config';
import limitsConfig from './config/limits.config';
import webrtcConfig from './config/webrtc.config';
import { CallModule } from './modules/call/call.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { MetricsModule } from './infrastructure/metrics/metrics.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { OutboxModule } from './infrastructure/outbox/outbox.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import appConfig from './config/app.config';
import authConfig from './config/auth.config';
import databaseConfig from './config/database.config';
import paymentConfig from './config/payment.config';
import redisConfig from './config/redis.config';
import storageConfig from './config/storage.config';
import scannerConfig from './config/scanner.config';
import aiConfig from './config/ai.config';
import mailConfig from './config/mail.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PaymentProviderModule } from './infrastructure/payment/payment.module';
import { validate } from './config/validation';
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { OtpModule } from './modules/otp/otp.module';
import { AdminModule } from './modules/admin/admin.module';
import { BookingModule } from './modules/booking/booking.module';
import { ClassificationModule } from './modules/classification/classification.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { ComplaintModule } from './modules/complaint/complaint.module';
import { CustomerModule } from './modules/customer/customer.module';
import { GeoModule } from './modules/geo/geo.module';
import { DisputeModule } from './modules/dispute/dispute.module';
import { MasterModule } from './modules/master/master.module';
import { MatchingModule } from './modules/matching/matching.module';
import { NotificationModule } from './modules/notification/notification.module';
import { OfferModule } from './modules/offer/offer.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { RequestModule } from './modules/request/request.module';
import { ReviewModule } from './modules/review/review.module';
import { ServiceModule } from './modules/service/service.module';
import { TrustModule } from './modules/trust/trust.module';
import { MailModule } from './modules/mail/mail.module';
import { MediaModule } from './modules/media/media.module';
import { WorkModule } from './modules/work/work.module';
import { WarrantyModule } from './modules/warranty/warranty.module';
import { LegalModule } from './modules/legal/legal.module';
import { TrustSafetyModule } from './modules/trust-safety/trust-safety.module';
import { AuditModule } from './modules/audit/audit.module';
import { UsersModule } from './modules/users/users.module';
import { ErrorLogModule } from './modules/error-log/error-log.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, expandVariables: true, load: [appConfig, authConfig, databaseConfig, paymentConfig, redisConfig, storageConfig, scannerConfig, aiConfig, mailConfig, telegramConfig, limitsConfig, webrtcConfig], validate }),
    ScheduleModule.forRoot(), RedisModule, QueueModule, OutboxModule, PaymentProviderModule,
    MetricsModule, TelegramModule, SmsModule, CallModule, SubscriptionModule, PrismaModule, AuthModule, OtpModule, AdminModule, BookingModule, ClassificationModule, CommunicationModule,
    ComplaintModule, CustomerModule, GeoModule, DisputeModule, MailModule, MasterModule, MatchingModule, MediaModule, NotificationModule,
    OfferModule, OrderModule, PaymentModule, RequestModule, ReviewModule, ServiceModule, TrustModule,
    WorkModule, WarrantyModule, LegalModule, TrustSafetyModule, AuditModule, UsersModule, ErrorLogModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}

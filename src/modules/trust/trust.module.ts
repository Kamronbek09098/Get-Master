import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { NotificationModule } from '../notification/notification.module';
import { TrustController } from './trust.controller';
import { TrustService } from './trust.service';

@Module({
  imports: [NotificationModule, StorageModule],
  controllers: [TrustController],
  providers: [TrustService],
  exports: [TrustService],
})
export class TrustModule {}

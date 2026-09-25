import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { BULLMQ_CONNECTION } from './queue.constants';
import { QueueService } from './queue.service';
import { OutboxProcessor } from './outbox.processor';
import { MediaProcessingModule } from '../media/media-processing.module';
import { StorageModule } from '../storage/storage.module';
import { ClassificationModule } from '../../modules/classification/classification.module';
import { MatchingModule } from '../../modules/matching/matching.module';

@Global()
@Module({
  imports: [MediaProcessingModule, StorageModule, ClassificationModule, MatchingModule],
  providers: [
    {
      provide: BULLMQ_CONNECTION,
      useFactory: (config: ConfigService) =>
        new Redis(config.getOrThrow<string>('redis.url'), { maxRetriesPerRequest: null }),
      inject: [ConfigService],
    },
    QueueService,
    OutboxProcessor,
  ],
  exports: [QueueService],
})
export class QueueModule {}

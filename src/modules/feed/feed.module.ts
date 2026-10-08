import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { MediaModule } from '../media/media.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

@Module({
  imports: [StorageModule, MediaModule],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}

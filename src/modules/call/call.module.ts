import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { CallRecordingService } from './call-recording.service';
import { CallController } from './call.controller';
import { CallEventsService } from './call-events.service';
import { CallService } from './call.service';

@Module({
  imports: [NotificationModule],
  controllers: [CallController],
  providers: [CallService, CallEventsService, CallRecordingService],
  exports: [CallService],
})
export class CallModule {}

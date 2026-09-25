import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { AvailabilityService } from './availability.service';
import { MasterStatsService } from './master-stats.service';
import { MasterController } from './master.controller';
import { MasterService } from './master.service';

@Module({
  imports: [StorageModule],
  controllers: [MasterController],
  providers: [MasterService, AvailabilityService, MasterStatsService],
  exports: [MasterService, AvailabilityService, MasterStatsService],
})
export class MasterModule {}

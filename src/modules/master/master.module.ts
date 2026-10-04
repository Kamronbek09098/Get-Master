import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { AvailabilityService } from './availability.service';
import { FavoriteController } from './favorite.controller';
import { FavoriteService } from './favorite.service';
import { MasterStatsService } from './master-stats.service';
import { MasterController } from './master.controller';
import { MasterService } from './master.service';

@Module({
  imports: [StorageModule],
  controllers: [MasterController, FavoriteController],
  providers: [MasterService, AvailabilityService, MasterStatsService, FavoriteService],
  exports: [MasterService, AvailabilityService, MasterStatsService],
})
export class MasterModule {}

import { Module } from '@nestjs/common';
import { GeoController } from './geo.controller';
import { MapProxyController } from './map-proxy.controller';
import { GeoService } from './geo.service';

@Module({
  controllers: [GeoController, MapProxyController],
  providers: [GeoService],
  exports: [GeoService],
})
export class GeoModule {}

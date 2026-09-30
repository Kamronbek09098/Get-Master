import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { GeoService } from './geo.service';

const num = (value: string | undefined): number | undefined => {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('suggest')
  async suggest(@Query('q') q = '', @Query('lat') lat?: string, @Query('lon') lon?: string) {
    return { provider: this.geo.provider().suggest, items: await this.geo.suggest(q, num(lat), num(lon)) };
  }

  @Get('geocode')
  async geocode(@Query('q') q?: string, @Query('uri') uri?: string) {
    return { provider: this.geo.provider().geocoder, place: await this.geo.geocode(q, uri) };
  }

  @Get('reverse')
  async reverse(@Query('lat') lat?: string, @Query('lon') lon?: string) {
    const latitude = num(lat);
    const longitude = num(lon);
    if (latitude === undefined || longitude === undefined || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      throw new BadRequestException('Koordinata noto‘g‘ri');
    }
    return { provider: this.geo.provider().geocoder, place: await this.geo.reverse(latitude, longitude) };
  }
}

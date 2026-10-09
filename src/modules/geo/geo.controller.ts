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
  async suggest(@Query('q') q = '', @Query('lat') lat?: string, @Query('lon') lon?: string, @Query('source') source?: string) {
    if (source === 'local') return { provider: 'local', items: this.geo.suggestLocal(q, num(lat), num(lon)) };
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

  /** Avtomobil marshruti: boshlanish (usta) va tugash (mijoz manzili) nuqtalari bo‘yicha asosiy va muqobil yo‘llar. */
  @Get('route')
  async route(@Query('fromLat') fromLat?: string, @Query('fromLon') fromLon?: string, @Query('toLat') toLat?: string, @Query('toLon') toLon?: string) {
    const [a, b, c, d] = [num(fromLat), num(fromLon), num(toLat), num(toLon)];
    if ([a, b, c, d].some((value) => value === undefined) || Math.abs(a!) > 90 || Math.abs(c!) > 90 || Math.abs(b!) > 180 || Math.abs(d!) > 180) {
      throw new BadRequestException('Koordinata noto‘g‘ri');
    }
    return { routes: await this.geo.route({ lat: a!, lon: b! }, { lat: c!, lon: d! }) };
  }
}

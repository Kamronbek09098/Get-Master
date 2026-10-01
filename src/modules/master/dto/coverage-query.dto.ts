import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsOptional, IsUUID } from 'class-validator';

export class CoverageQueryDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lon!: number;

  @IsOptional()
  @IsUUID()
  serviceId?: string;
}

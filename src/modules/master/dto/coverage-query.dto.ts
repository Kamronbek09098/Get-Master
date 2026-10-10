import { IsUUID } from '../../../common/validators/any-uuid';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsOptional } from 'class-validator';

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

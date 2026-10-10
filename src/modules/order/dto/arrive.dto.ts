import { IsLatitude, IsLongitude, IsNumber, IsOptional, Max, Min } from 'class-validator';

/** Usta yetib kelganini belgilashda qurilmasining joylashuvi (mijoz manzili koordinatali bo‘lsa — majburiy). */
export class ArriveDto {
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  /** GPS aniqligi (metr). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100_000)
  accuracy?: number;

  /** GPS nuqtasi olingan vaqt (epoch, ms). */
  @IsOptional()
  @IsNumber()
  fixedAt?: number;
}

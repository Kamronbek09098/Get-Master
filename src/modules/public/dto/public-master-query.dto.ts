import { IsUUID } from '../../../common/validators/any-uuid';
import { Type } from 'class-transformer';
import { ServiceMode } from '@prisma/client';
import { IsIn } from 'class-validator';
import { REGION_KEYS } from '../../../common/constants/regions';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class PublicMasterQueryDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  limit?: number;

  @IsOptional()
  @IsEnum(ServiceMode)
  mode?: ServiceMode;

  /** Hudud kaliti (14 hudud): faqat shu hududdagi ustalar. */
  @IsOptional()
  @IsIn(REGION_KEYS)
  region?: string;
}

/** Xizmatlar katalogi (mijoz paneli «Xizmatlar»): qidiruv, filtrlar, saralash va sahifalash. */
export class PublicServiceQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  /** Kategoriya id'lari, vergul bilan ajratilgan (bir nechtasini tanlash mumkin). */
  @IsOptional()
  @IsString()
  @Matches(/^[0-9a-f-]{36}(,[0-9a-f-]{36}){0,19}$/i)
  categories?: string;

  /** Hudud kaliti: shu hududdagi ustalar bo‘yicha narx, reyting va usta soni hisoblanadi. */
  @IsOptional()
  @IsIn(REGION_KEYS)
  region?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  maxPrice?: number;

  /** Xizmat ko‘rsatuvchi ustalar soni: 1, 2-3 yoki 4+. */
  @IsOptional()
  @IsIn(['1', '2-3', '4+'])
  masters?: '1' | '2-3' | '4+';

  /** Eng kam reyting (masalan, 4.5). */
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(5)
  minRating?: number;

  /** true — faqat hozir kamida bitta usta xizmat ko‘rsatadigan xizmatlar. */
  @IsOptional()
  @IsIn(['true'])
  available?: 'true';

  @IsOptional()
  @IsIn(['popular', 'price_asc', 'price_desc', 'rating', 'name'])
  sort?: 'popular' | 'price_asc' | 'price_desc' | 'rating' | 'name';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  limit?: number;
}

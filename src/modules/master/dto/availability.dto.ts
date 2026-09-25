import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { TIME_PATTERN } from '../../../common/utils/schedule';

export class CreateAvailabilityDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @Matches(TIME_PATTERN, { message: 'Boshlanish vaqti SS:DD (24 soat) formatida bo‘lishi kerak' })
  startTime!: string;

  @Matches(TIME_PATTERN, { message: 'Tugash vaqti SS:DD (24 soat) formatida bo‘lishi kerak' })
  endTime!: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  effectiveFrom?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  effectiveUntil?: Date;
}

export class UpdateAvailabilityDto extends PartialType(CreateAvailabilityDto) {}

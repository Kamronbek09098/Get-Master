import { Type } from 'class-transformer';
import { IsDate, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class MasterStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: 'ACTIVE' | 'INACTIVE';
}

export class PauseMasterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason!: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  until?: Date;
}

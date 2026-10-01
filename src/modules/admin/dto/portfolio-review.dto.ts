import { PortfolioStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { CursorQueryDto } from '../../../common/dto/cursor-query.dto';

export class PortfolioQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsEnum(PortfolioStatus)
  status?: PortfolioStatus;

  /** `true` bo‘lsa — ko‘rib chiqilgan (tasdiqlangan/rad etilgan) ishlar tarixi. */
  @IsOptional()
  @IsIn(['true', 'false'])
  history?: string;
}

export class ReviewPortfolioDto {
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @ValidateIf((dto: ReviewPortfolioDto) => dto.decision === 'REJECT')
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason?: string;
}

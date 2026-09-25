import { IsDateString, IsOptional } from 'class-validator';

/** Har bir bo‘lim uchun: shu vaqtdan keyin paydo bo‘lgan yangi elementlar soni. */
export class AdminBadgesQueryDto {
  @IsOptional()
  @IsDateString()
  usersSince?: string;

  @IsOptional()
  @IsDateString()
  chatsSince?: string;

  @IsOptional()
  @IsDateString()
  verificationsSince?: string;

  @IsOptional()
  @IsDateString()
  casesSince?: string;

  @IsOptional()
  @IsDateString()
  appealsSince?: string;

  @IsOptional()
  @IsDateString()
  ordersSince?: string;
}

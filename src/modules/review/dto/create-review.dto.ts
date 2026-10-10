import { IsUUID } from '../../../common/validators/any-uuid';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** Ruxsat etilgan baholar: 0.5 qadam bilan 0.5 dan 5 gacha (yarim yulduz). */
export const REVIEW_RATINGS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

export class CreateReviewDto {
  @IsUUID()
  orderId!: string;

  @IsIn(REVIEW_RATINGS)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

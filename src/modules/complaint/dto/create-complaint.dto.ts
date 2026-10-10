import { IsUUID } from '../../../common/validators/any-uuid';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateComplaintDto {
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description!: string;
}

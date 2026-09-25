import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateComplaintDto {
  @IsOptional()
  @IsUUID('4')
  orderId?: string;

  @IsOptional()
  @IsUUID('4')
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

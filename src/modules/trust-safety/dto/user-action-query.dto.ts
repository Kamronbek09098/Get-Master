import { IsOptional, IsUUID } from 'class-validator';

export class UserActionQueryDto {
  @IsOptional()
  @IsUUID('4')
  userId?: string;
}

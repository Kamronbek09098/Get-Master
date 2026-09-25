import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

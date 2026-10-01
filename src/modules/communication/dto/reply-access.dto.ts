import { IsBoolean } from 'class-validator';

export class ReplyAccessDto {
  @IsBoolean()
  allowed!: boolean;
}

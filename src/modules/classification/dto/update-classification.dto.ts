import { IsNotEmpty, IsUUID } from 'class-validator';

export class UpdateClassificationDto {
  @IsUUID('4')
  @IsNotEmpty()
  serviceId!: string;
}

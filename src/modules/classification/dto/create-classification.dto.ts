import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateClassificationDto {
  @IsUUID('4')
  @IsNotEmpty()
  serviceId!: string;
}

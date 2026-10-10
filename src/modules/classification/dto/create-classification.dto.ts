import { IsUUID } from '../../../common/validators/any-uuid';
import { IsNotEmpty } from 'class-validator';

export class CreateClassificationDto {
  @IsUUID()
  @IsNotEmpty()
  serviceId!: string;
}

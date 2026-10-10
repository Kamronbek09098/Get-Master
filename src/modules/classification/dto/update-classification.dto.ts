import { IsUUID } from '../../../common/validators/any-uuid';
import { IsNotEmpty } from 'class-validator';

export class UpdateClassificationDto {
  @IsUUID()
  @IsNotEmpty()
  serviceId!: string;
}

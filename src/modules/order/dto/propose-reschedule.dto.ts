import { IsDateString } from 'class-validator';

export class ProposeRescheduleDto {
  @IsDateString()
  scheduledStartAt!: string;
}

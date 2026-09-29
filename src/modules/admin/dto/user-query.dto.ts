import { UserStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CursorQueryDto } from '../../../common/dto/cursor-query.dto';

export class UserQueryDto extends CursorQueryDto {
  // Adminlar bu ro‘yxatda hech qachon ko‘rinmasligi kerak (faqat mijoz/usta boshqaruvi uchun),
  // shuning uchun rol filtri ham ADMIN’ni qabul qilmaydi — aks holda admin boshqa adminlarni
  // shu umumiy ro‘yxatdan ochiq qidirib topa olardi.
  @IsOptional()
  @IsIn(['CUSTOMER', 'MASTER'])
  role?: 'CUSTOMER' | 'MASTER';

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

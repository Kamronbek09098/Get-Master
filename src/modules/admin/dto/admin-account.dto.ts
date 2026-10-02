import { ArrayUnique, IsArray, IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ADMIN_PERMISSIONS } from '../../../common/constants/admin-permissions';

export class CreateAdminDto {
  @IsString()
  @Matches(/^\+?998\d{9}$/, { message: 'Telefon raqami +998XXXXXXXXX ko‘rinishida bo‘lishi kerak' })
  phone!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @Matches(/\S/, { message: 'Ism kiritilishi shart' })
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @Matches(/\S/, { message: 'Familiya kiritilishi shart' })
  @MaxLength(100)
  lastName!: string;

  /** Yangi adminga superadmin huquqi berilsinmi (odatda — yo‘q). */
  @IsOptional()
  @IsBoolean()
  isSuperAdmin?: boolean;

  /** Oddiy admin qaysi bo‘limlarga kira olishi (superadmin uchun e’tiborga olinmaydi). */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(ADMIN_PERMISSIONS, { each: true })
  permissions?: string[];
}

export class SetAdminPermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsIn(ADMIN_PERMISSIONS, { each: true })
  permissions!: string[];
}

export class SetSuperAdminDto {
  @IsBoolean()
  value!: boolean;
}

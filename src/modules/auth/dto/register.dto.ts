import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsPhoneNumber('UZ')
  @IsNotEmpty()
  phone!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @Matches(/\S/, { message: 'firstName kiritilishi shart' })
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @Matches(/\S/, { message: 'lastName kiritilishi shart' })
  @MaxLength(100)
  lastName!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  acceptedPolicyIds!: string[];
}

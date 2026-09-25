import { IsNotEmpty, IsPhoneNumber, IsString, MaxLength } from 'class-validator';

export class SignInDto {
  @IsPhoneNumber('UZ')
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

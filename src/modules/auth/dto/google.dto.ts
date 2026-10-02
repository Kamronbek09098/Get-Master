import { ArrayNotEmpty, ArrayUnique, IsArray, IsNotEmpty, IsPhoneNumber, IsString, IsUUID, MaxLength } from 'class-validator';

export class GoogleSignInDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  credential!: string;
}

export class GoogleRegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  signupToken!: string;

  @IsPhoneNumber('UZ')
  @IsNotEmpty()
  phone!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  acceptedPolicyIds!: string[];
}

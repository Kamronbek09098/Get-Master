import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';
import { ERRORS } from '../common/constants/error-messages';

class EnvironmentVariables {
  @IsIn(['development', 'test', 'staging', 'production'])
  NODE_ENV!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsOptional()
  @IsString()
  REDIS_URL?: string;

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  MAX_ACTIVE_DEVICES?: number;

  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @IsOptional()
  @IsString()
  SMTP_FROM?: string;

  @IsOptional()
  @IsString()
  PAYMENT_PROVIDER_BASE_URL?: string;
}

export function validate(config: Record<string, unknown>) {
  const values = plainToInstance(
    EnvironmentVariables,
    {
      ...config,
      PORT: Number(config.PORT ?? 3000),
      NODE_ENV: config.NODE_ENV ?? 'development',
      MAX_ACTIVE_DEVICES: Number(config.MAX_ACTIVE_DEVICES ?? 2),
    },
    { enableImplicitConversion: true },
  );

  const errors = validateSync(values, {
    skipMissingProperties: false,
  });
  if (errors.length) {
    throw new Error(
      ERRORS.ENV_INVALID(
        errors.map((error) => Object.values(error.constraints ?? {}).join(', ')).join('; '),
      ),
    );
  }

  if (values.JWT_SECRET.length < 32) {
    throw new Error(ERRORS.JWT_SECRET_SHORT);
  }

  if (!/^postgres(ql)?:\/\//.test(values.DATABASE_URL)) {
    throw new Error(ERRORS.DATABASE_URL_INVALID);
  }

  if (values.NODE_ENV === 'production' && !values.REDIS_URL) {
    throw new Error(ERRORS.REDIS_URL_REQUIRED);
  }
  if (values.REDIS_URL && !/^rediss?:\/\//.test(values.REDIS_URL)) {
    throw new Error(ERRORS.REDIS_URL_INVALID);
  }
  if (values.SMTP_HOST && !values.SMTP_FROM) {
    throw new Error(ERRORS.SMTP_FROM_REQUIRED);
  }
  if (values.PAYMENT_PROVIDER_BASE_URL && !/^https?:\/\//.test(values.PAYMENT_PROVIDER_BASE_URL)) {
    throw new Error(ERRORS.PAYMENT_URL_INVALID);
  }

  if (values.NODE_ENV === 'production' && config.AUTH_COOKIE_SECURE === 'false') {
    throw new Error(ERRORS.COOKIE_SECURE_REQUIRED);
  }

  return values;
}

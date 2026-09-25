import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform, ValidationPipe } from '@nestjs/common';
import { extname } from 'node:path';
import { ValidationError } from 'class-validator';
import { ERRORS } from '../constants/error-messages';
import { collectValidationMessages } from '../constants/validation-messages';

@Injectable()
export class ImageValidationPipe implements PipeTransform<any> {
  private readonly allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic'];
  private readonly allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  private readonly maxFileSize = 20 * 1024 * 1024;
  transform(file: any) { if (!file) return file; if (file.size > this.maxFileSize) throw new BadRequestException(ERRORS.FILE_TOO_LARGE); const ext = extname(file.originalname).toLowerCase(); if (!this.allowedExtensions.includes(ext) || !this.allowedMimeTypes.includes(file.mimetype)) throw new BadRequestException(ERRORS.INVALID_IMAGE); return file; }
}

function containsNul(value: unknown, depth = 0): boolean {
  if (typeof value === 'string') return value.includes('\u0000');
  if (depth > 8 || value === null || typeof value !== 'object') return false;
  return Object.values(value as Record<string, unknown>).some((item) => containsNul(item, depth + 1));
}

class SafeValidationPipe extends ValidationPipe {
  override async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    if (metadata.type !== 'custom' && containsNul(value)) {
      throw new BadRequestException(ERRORS.NUL_CHARACTERS);
    }
    return super.transform(value, metadata);
  }
}

export function createValidationPipe(): ValidationPipe {
  return new SafeValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    exceptionFactory: (errors: ValidationError[]) =>
      new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: ERRORS.VALIDATION_FAILED,
        details: collectValidationMessages(errors),
      }),
  });
}

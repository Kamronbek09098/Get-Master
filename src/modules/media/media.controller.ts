import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MediaService } from './media.service';
import { InitiateUploadDto } from './dto/initiate-upload.dto';
import { ERRORS } from '../../common/constants/error-messages';

const HARD_UPLOAD_LIMIT_BYTES = 11 * 1024 * 1024;

/** Multer fayl nomini Latin-1 deb o‘qiydi; kirill va o‘zbek harflari buzilmasligi uchun UTF-8 ga qaytaramiz. */
const decodeFilename = (name: string) => {
  if (/[^\u0000-\u00ff]/.test(name)) return name; // allaqachon to‘g‘ri UTF-8
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('\ufffd') ? name : decoded;
};

const MEDIA_VARIANTS = { original: 'original', thumbnail: 'thumbnail', medium: 'medium' } as const;
type MediaVariant = keyof typeof MEDIA_VARIANTS;

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('uploads')
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: HARD_UPLOAD_LIMIT_BYTES } }),
  )
  upload(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: InitiateUploadDto,
  ) {
    if (!file) throw new BadRequestException(ERRORS.FILE_REQUIRED);
    return this.mediaService.initiateUpload(
      userId,
      { buffer: file.buffer, originalname: decodeFilename(file.originalname), mimetype: file.mimetype, size: file.size },
      dto.kind,
      { type: dto.linkType, id: dto.linkId },
    );
  }

  @Get(':id')
  getStatus(
    @CurrentUser('sub') userId: string,
    @CurrentUser('roles') roles: Role[],
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.mediaService.getStatus(userId, roles, id);
  }

  @Get(':id/:variant')
  getSignedUrl(
    @CurrentUser('sub') userId: string,
    @CurrentUser('roles') roles: Role[],
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variant', new ParseEnumPipe(MEDIA_VARIANTS)) variant: MediaVariant,
  ) {
    return this.mediaService.getSignedUrl(userId, roles, id, variant);
  }
}

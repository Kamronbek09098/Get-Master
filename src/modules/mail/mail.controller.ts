import { Body, Controller, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { SendMailDto } from './dto/send-mail.dto';
import { MailService } from './mail.service';

@Controller('mail')
@Roles(Role.ADMIN)
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('send')
  send(@Body() dto: SendMailDto) {
    return this.mailService.send(dto);
  }
}

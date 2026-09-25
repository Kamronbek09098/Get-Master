import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateAdditionalWorkDto } from './dto/create-additional-work.dto';
import { WorkService } from './work.service';

@Controller()
export class WorkController {
  constructor(private readonly workService: WorkService) {}

  @Post('orders/:orderId/additional-work')
  @Roles(Role.MASTER)
  create(
    @CurrentUser('sub') userId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateAdditionalWorkDto,
  ) {
    return this.workService.create(userId, orderId, dto);
  }

  @Get('orders/:orderId/additional-work')
  findAll(@CurrentUser('sub') userId: string, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.workService.findAll(userId, orderId);
  }

  @Post('additional-work/:id/approve')
  @Roles(Role.CUSTOMER)
  approve(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.workService.approve(userId, id);
  }

  @Post('additional-work/:id/reject')
  @Roles(Role.CUSTOMER)
  reject(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.workService.reject(userId, id);
  }

  @Post('additional-work/:id/cancel')
  @Roles(Role.MASTER)
  cancel(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.workService.cancel(userId, id);
  }
}

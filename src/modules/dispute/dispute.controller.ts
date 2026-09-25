import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { DisputeQueryDto } from './dto/dispute-query.dto';
import { UpdateDisputeStatusDto } from './dto/update-dispute-status.dto';
import { DisputeService } from './dispute.service';

@Controller('disputes')
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  @Post()
  @Roles(Role.CUSTOMER, Role.MASTER)
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateDisputeDto) {
    return this.disputeService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser('sub') userId: string, @Query() query: DisputeQueryDto) {
    return this.disputeService.findAll(userId, query);
  }

  @Get('admin/all')
  @Roles(Role.ADMIN)
  findAllForAdmin(@Query() query: DisputeQueryDto) {
    return this.disputeService.findAllForAdmin(query);
  }

  @Get(':id')
  findOne(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.disputeService.findOne(userId, id);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  updateStatus(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDisputeStatusDto,
  ) {
    return this.disputeService.updateStatus(adminId, id, dto);
  }
}

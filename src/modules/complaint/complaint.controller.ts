import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresPermission } from '../../common/decorators/permission.decorator';
import { ComplaintQueryDto } from './dto/complaint-query.dto';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintStatusDto } from './dto/update-complaint-status.dto';
import { ComplaintService } from './complaint.service';

@Controller('complaints')
export class ComplaintController {
  constructor(private readonly complaintService: ComplaintService) {}

  @Post()
  @Roles(Role.CUSTOMER, Role.MASTER)
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateComplaintDto) {
    return this.complaintService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser('sub') userId: string, @Query() query: ComplaintQueryDto) {
    return this.complaintService.findAll(userId, query);
  }

  @Get('admin/all')
  @Roles(Role.ADMIN)
  @RequiresPermission('CASES')
  findAllForAdmin(@Query() query: ComplaintQueryDto) {
    return this.complaintService.findAllForAdmin(query);
  }

  @Get(':id')
  findOne(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.complaintService.findOne(userId, id);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  @RequiresPermission('CASES')
  updateStatus(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateComplaintStatusDto,
  ) {
    return this.complaintService.updateStatus(adminId, id, dto);
  }
}

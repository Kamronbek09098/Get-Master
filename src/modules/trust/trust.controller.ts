import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresPermission } from '../../common/decorators/permission.decorator';
import { TrustService } from './trust.service';
import { ReviewVerificationDto, SubmitVerificationDto, VerificationQueryDto } from './dto/verification.dto';

@Controller('trust')
export class TrustController {
  constructor(private readonly trustService: TrustService) {}

  @Post('verifications')
  @Roles(Role.MASTER)
  create(@CurrentUser('sub') userId: string, @Body() dto: SubmitVerificationDto) {
    return this.trustService.create(userId, dto);
  }

  @Delete('verifications/:id')
  @Roles(Role.MASTER)
  remove(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.trustService.remove(userId, id);
  }

  @Get('verifications')
  @Roles(Role.MASTER)
  findAll(@CurrentUser('sub') userId: string) {
    return this.trustService.findAll(userId);
  }

  @Get('status')
  @Roles(Role.MASTER)
  getStatus(@CurrentUser('sub') userId: string) {
    return this.trustService.getStatus(userId);
  }

  @Get('admin/verifications')
  @Roles(Role.ADMIN)
  @RequiresPermission('VERIFICATIONS')
  findAllForAdmin(@Query() query: VerificationQueryDto) {
    return this.trustService.findAllForAdmin(query);
  }

  @Get('admin/verifications/:id')
  @Roles(Role.ADMIN)
  @RequiresPermission('VERIFICATIONS')
  findOneForAdmin(@Param('id', ParseUUIDPipe) id: string) {
    return this.trustService.findOneForAdmin(id);
  }

  @Post('admin/verifications/:id/review')
  @Roles(Role.ADMIN)
  @RequiresPermission('VERIFICATIONS')
  review(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewVerificationDto,
  ) {
    return this.trustService.review(adminId, id, dto);
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresPermission } from '../../common/decorators/permission.decorator';
import { CreateAppealDto } from './dto/create-appeal.dto';
import { CreateCompensationDto } from './dto/create-compensation.dto';
import { CreateUserActionDto } from './dto/create-user-action.dto';
import { UpdateAppealDto } from './dto/update-appeal.dto';
import { UserActionQueryDto } from './dto/user-action-query.dto';
import { TrustSafetyService } from './trust-safety.service';

@Controller()
export class TrustSafetyController {
  constructor(private readonly trustSafetyService: TrustSafetyService) {}

  @Post('user-actions')
  @Roles(Role.ADMIN)
  @RequiresPermission('SAFETY')
  createAction(@CurrentUser('sub') adminId: string, @Body() dto: CreateUserActionDto) {
    return this.trustSafetyService.createAction(adminId, dto);
  }

  @Get('user-actions')
  @Roles(Role.ADMIN)
  @RequiresPermission('SAFETY')
  findAllActions(@Query() query: UserActionQueryDto) {
    return this.trustSafetyService.findAllActions(query);
  }

  @Get('user-actions/me')
  findMyActions(@CurrentUser('sub') userId: string) {
    return this.trustSafetyService.findAllActions({ userId });
  }

  @Post('user-actions/:id/lift')
  @Roles(Role.ADMIN)
  @RequiresPermission('SAFETY')
  liftAction(@CurrentUser('sub') adminId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.trustSafetyService.liftAction(adminId, id);
  }

  @Post('appeals')
  createAppeal(@CurrentUser('sub') userId: string, @Body() dto: CreateAppealDto) {
    return this.trustSafetyService.createAppeal(userId, dto);
  }

  @Get('appeals/me')
  findMyAppeals(@CurrentUser('sub') userId: string) {
    return this.trustSafetyService.findMyAppeals(userId);
  }

  @Get('appeals')
  @Roles(Role.ADMIN)
  @RequiresPermission('SAFETY')
  findAllAppeals() {
    return this.trustSafetyService.findAllAppeals();
  }

  @Patch('appeals/:id')
  @Roles(Role.ADMIN)
  @RequiresPermission('SAFETY')
  updateAppeal(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppealDto,
  ) {
    return this.trustSafetyService.updateAppeal(adminId, id, dto);
  }

  @Post('compensations')
  @Roles(Role.ADMIN)
  @RequiresPermission('SAFETY')
  createCompensation(@CurrentUser('sub') adminId: string, @Body() dto: CreateCompensationDto) {
    return this.trustSafetyService.createCompensation(adminId, dto);
  }

  @Get('compensations/me')
  findMyCompensations(@CurrentUser('sub') userId: string) {
    return this.trustSafetyService.findMyCompensations(userId);
  }
}

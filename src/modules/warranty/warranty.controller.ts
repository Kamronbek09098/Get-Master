import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresPermission } from '../../common/decorators/permission.decorator';
import { CreateWarrantyClaimDto } from './dto/create-warranty-claim.dto';
import { CreateWarrantyDto } from './dto/create-warranty.dto';
import { UpdateWarrantyClaimDto } from './dto/update-warranty-claim.dto';
import { WarrantyService } from './warranty.service';

@Controller()
export class WarrantyController {
  constructor(private readonly warrantyService: WarrantyService) {}

  @Post('warranties')
  @Roles(Role.MASTER)
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateWarrantyDto) {
    return this.warrantyService.create(userId, dto);
  }

  @Get('warranties')
  findAll(@CurrentUser('sub') userId: string) {
    return this.warrantyService.findAll(userId);
  }

  @Get('warranties/:id')
  findOne(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.warrantyService.findOne(userId, id);
  }

  @Post('warranties/:id/claims')
  @Roles(Role.CUSTOMER)
  createClaim(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateWarrantyClaimDto,
  ) {
    return this.warrantyService.createClaim(userId, id, dto);
  }

  @Get('warranties/:id/claims')
  findAllClaims(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.warrantyService.findAllClaims(userId, id);
  }

  @Patch('warranty-claims/:id')
  @Roles(Role.ADMIN)
  @RequiresPermission('CASES')
  updateClaim(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarrantyClaimDto,
  ) {
    return this.warrantyService.updateClaim(adminId, id, dto);
  }
}

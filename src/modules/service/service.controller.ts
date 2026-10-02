import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequiresPermission } from '../../common/decorators/permission.decorator';
import { ServiceService } from './service.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { ServiceQueryDto } from './dto/service-query.dto';
import { CreateMasterServiceDto, UpdateMasterServiceDto } from './dto/master-service.dto';

@Controller()
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Public()
  @Get('service-categories')
  findAllCategories() {
    return this.serviceService.findAllCategories();
  }

  @Public()
  @Get('services')
  findAll(@Query() query: ServiceQueryDto) {
    return this.serviceService.findAll(query);
  }

  @Public()
  @Get('services/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviceService.findOne(id);
  }

  @Post('service-categories')
  @Roles(Role.ADMIN)
  @RequiresPermission('CATALOG')
  createCategory(@CurrentUser('sub') actorId: string, @Body() dto: CreateCategoryDto) {
    return this.serviceService.createCategory(actorId, dto);
  }

  @Patch('service-categories/:id')
  @Roles(Role.ADMIN)
  @RequiresPermission('CATALOG')
  updateCategory(
    @CurrentUser('sub') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.serviceService.updateCategory(actorId, id, dto);
  }

  @Delete('service-categories/:id')
  @Roles(Role.ADMIN)
  @RequiresPermission('CATALOG')
  removeCategory(@CurrentUser('sub') actorId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.serviceService.removeCategory(actorId, id);
  }

  @Post('services')
  @Roles(Role.ADMIN)
  @RequiresPermission('CATALOG')
  create(@CurrentUser('sub') actorId: string, @Body() dto: CreateServiceDto) {
    return this.serviceService.create(actorId, dto);
  }

  @Patch('services/:id')
  @Roles(Role.ADMIN)
  @RequiresPermission('CATALOG')
  update(
    @CurrentUser('sub') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.serviceService.update(actorId, id, dto);
  }

  @Delete('services/:id')
  @Roles(Role.ADMIN)
  @RequiresPermission('CATALOG')
  remove(@CurrentUser('sub') actorId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.serviceService.remove(actorId, id);
  }

  @Get('masters/me/services')
  @Roles(Role.MASTER)
  findMyServices(@CurrentUser('sub') userId: string) {
    return this.serviceService.findMyServices(userId);
  }

  @Post('masters/me/services')
  @Roles(Role.MASTER)
  createMyService(@CurrentUser('sub') userId: string, @Body() dto: CreateMasterServiceDto) {
    return this.serviceService.createMyService(userId, dto);
  }

  @Patch('masters/me/services/:serviceId')
  @Roles(Role.MASTER)
  updateMyService(
    @CurrentUser('sub') userId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() dto: UpdateMasterServiceDto,
  ) {
    return this.serviceService.updateMyService(userId, serviceId, dto);
  }

  @Delete('masters/me/services/:serviceId')
  @Roles(Role.MASTER)
  removeMyService(@CurrentUser('sub') userId: string, @Param('serviceId', ParseUUIDPipe) serviceId: string) {
    return this.serviceService.removeMyService(userId, serviceId);
  }
}

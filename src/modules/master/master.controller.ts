import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MasterService } from './master.service';
import { AvailabilityService } from './availability.service';
import { CreateMasterDto } from './dto/create-master.dto';
import { UpdateMasterDto } from './dto/update-master.dto';
import { MasterQueryDto } from './dto/master-query.dto';
import { CursorQueryDto } from '../../common/dto/cursor-query.dto';
import { OpenRequestsQueryDto } from './dto/open-requests-query.dto';
import { MasterStatusDto, PauseMasterDto } from './dto/master-status.dto';
import { CreateAvailabilityDto, UpdateAvailabilityDto } from './dto/availability.dto';
import { CreatePortfolioDto, UpdatePortfolioDto } from './dto/portfolio.dto';

@Controller('masters')
export class MasterController {
  constructor(
    private readonly masterService: MasterService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  @Post('me')
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateMasterDto) {
    return this.masterService.create(userId, dto);
  }

  @Get('me')
  @Roles(Role.MASTER)
  findMe(@CurrentUser('sub') userId: string) {
    return this.masterService.findMe(userId);
  }

  @Patch('me')
  @Roles(Role.MASTER)
  update(@CurrentUser('sub') userId: string, @Body() dto: UpdateMasterDto) {
    return this.masterService.update(userId, dto);
  }

  @Patch('me/status')
  @Roles(Role.MASTER)
  updateStatus(@CurrentUser('sub') userId: string, @Body() dto: MasterStatusDto) {
    return this.masterService.updateStatus(userId, dto);
  }

  @Post('me/pause')
  @Roles(Role.MASTER)
  pause(@CurrentUser('sub') userId: string, @Body() dto: PauseMasterDto) {
    return this.masterService.pause(userId, dto);
  }

  @Post('me/resume')
  @Roles(Role.MASTER)
  resume(@CurrentUser('sub') userId: string) {
    return this.masterService.resume(userId);
  }

  @Get('me/availability')
  @Roles(Role.MASTER)
  async findAllAvailability(@CurrentUser('sub') userId: string) {
    const profile = await this.masterService.findMe(userId);
    return this.availabilityService.findAll(profile.id);
  }

  @Post('me/availability')
  @Roles(Role.MASTER)
  async createAvailability(@CurrentUser('sub') userId: string, @Body() dto: CreateAvailabilityDto) {
    const profile = await this.masterService.findMe(userId);
    return this.availabilityService.create(profile.id, dto);
  }

  @Patch('me/availability/:id')
  @Roles(Role.MASTER)
  async updateAvailability(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    const profile = await this.masterService.findMe(userId);
    return this.availabilityService.update(profile.id, id, dto);
  }

  @Delete('me/availability/:id')
  @Roles(Role.MASTER)
  async removeAvailability(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    const profile = await this.masterService.findMe(userId);
    return this.availabilityService.remove(profile.id, id);
  }

  @Get('me/incoming-requests')
  @Roles(Role.MASTER)
  findIncomingRequests(@CurrentUser('sub') userId: string, @Query() query: CursorQueryDto) {
    return this.masterService.findIncomingRequests(userId, query);
  }

  @Get('me/open-requests')
  @Roles(Role.MASTER)
  findOpenRequests(@CurrentUser('sub') userId: string, @Query() query: OpenRequestsQueryDto) {
    return this.masterService.findOpenRequests(userId, query);
  }

  @Get('me/portfolio')
  @Roles(Role.MASTER)
  findAllPortfolio(@CurrentUser('sub') userId: string) {
    return this.masterService.findAllPortfolio(userId);
  }

  @Post('me/portfolio')
  @Roles(Role.MASTER)
  createPortfolio(@CurrentUser('sub') userId: string, @Body() dto: CreatePortfolioDto) {
    return this.masterService.createPortfolio(userId, dto);
  }

  @Patch('me/portfolio/:id')
  @Roles(Role.MASTER)
  updatePortfolio(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePortfolioDto,
  ) {
    return this.masterService.updatePortfolio(userId, id, dto);
  }

  @Delete('me/portfolio/:id')
  @Roles(Role.MASTER)
  removePortfolio(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.masterService.removePortfolio(userId, id);
  }

  @Get()
  findAll(@Query() query: MasterQueryDto) {
    return this.masterService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.masterService.findOne(id);
  }
}

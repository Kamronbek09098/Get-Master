import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestService } from './request.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { CancelRequestDto } from './dto/cancel-request.dto';
import { RequestQueryDto } from './dto/request-query.dto';

@Controller('problem-requests')
@Roles(Role.CUSTOMER)
export class RequestController {
  constructor(private readonly requestService: RequestService) {}

  @Post()
  create(@CurrentUser('sub') customerId: string, @Body() dto: CreateRequestDto) {
    return this.requestService.create(customerId, dto);
  }

  @Get()
  findAll(@CurrentUser('sub') customerId: string, @Query() query: RequestQueryDto) {
    return this.requestService.findAll(customerId, query);
  }

  @Get(':id')
  findOne(@CurrentUser('sub') customerId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.requestService.findOne(customerId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('sub') customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRequestDto,
  ) {
    return this.requestService.update(customerId, id, dto);
  }

  @Post(':id/submit')
  submit(@CurrentUser('sub') customerId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.requestService.submit(customerId, id);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser('sub') customerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelRequestDto,
  ) {
    return this.requestService.cancel(customerId, id, dto);
  }
}

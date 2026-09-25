import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CustomerService } from './customer.service';
import { UpdateProfileDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@Controller('customers/me')
@Roles(Role.CUSTOMER)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  findOne(@CurrentUser('sub') userId: string) {
    return this.customerService.findOne(userId);
  }

  @Get('badges')
  getBadges(@CurrentUser('sub') userId: string, @Query('offersSince') offersSince?: string) {
    return this.customerService.getBadges(userId, offersSince);
  }

  @Patch()
  update(@CurrentUser('sub') userId: string, @Body() dto: UpdateProfileDto) {
    return this.customerService.update(userId, dto);
  }

  @Get('preferences')
  findPreferences(@CurrentUser('sub') userId: string) {
    return this.customerService.findPreferences(userId);
  }

  @Patch('preferences')
  updatePreferences(@CurrentUser('sub') userId: string, @Body() dto: UpdateCustomerDto) {
    return this.customerService.updatePreferences(userId, dto);
  }

  @Get('addresses')
  findAllAddresses(@CurrentUser('sub') userId: string) {
    return this.customerService.findAllAddresses(userId);
  }

  @Post('addresses')
  createAddress(@CurrentUser('sub') userId: string, @Body() dto: CreateAddressDto) {
    return this.customerService.createAddress(userId, dto);
  }

  @Patch('addresses/:id')
  updateAddress(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.customerService.updateAddress(userId, id, dto);
  }

  @Delete('addresses/:id')
  removeAddress(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.customerService.removeAddress(userId, id);
  }
}

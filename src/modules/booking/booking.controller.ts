import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BookingService } from './booking.service';

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Get()
  findAll(@CurrentUser('sub') userId: string) {
    return this.bookingService.findAll(userId);
  }

  @Get(':id')
  findOne(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookingService.findOne(userId, id);
  }
}

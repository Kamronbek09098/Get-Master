import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { FavoriteService } from './favorite.service';

@Controller('customers/me/favorites')
@Roles(Role.CUSTOMER)
export class FavoriteController {
  constructor(private readonly favorites: FavoriteService) {}

  @Get()
  list(@CurrentUser('sub') userId: string) {
    return this.favorites.list(userId);
  }

  @Put(':masterId')
  add(@CurrentUser('sub') userId: string, @Param('masterId', ParseUUIDPipe) masterId: string) {
    return this.favorites.add(userId, masterId);
  }

  @Delete(':masterId')
  remove(@CurrentUser('sub') userId: string, @Param('masterId', ParseUUIDPipe) masterId: string) {
    return this.favorites.remove(userId, masterId);
  }
}

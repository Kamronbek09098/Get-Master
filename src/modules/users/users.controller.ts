import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SetPasswordDto } from './dto/set-password.dto';
import { SetTwoFactorDto } from './dto/two-factor.dto';
import { UpdateNameDto } from './dto/update-name.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  findMe(@CurrentUser('sub') userId: string) {
    return this.usersService.findMe(userId);
  }

  @Patch('me/two-factor')
  setTwoFactor(@CurrentUser('sub') userId: string, @Body() dto: SetTwoFactorDto) {
    return this.usersService.setTwoFactor(userId, dto);
  }

  /** Parolsiz (masalan, Google orqali ochilgan) akkauntga birinchi marta parol o‘rnatish. */
  @Post('me/password')
  setPassword(@CurrentUser('sub') userId: string, @Body() dto: SetPasswordDto) {
    return this.usersService.setInitialPassword(userId, dto.password);
  }

  @Patch('me/name')
  updateName(@CurrentUser('sub') userId: string, @Body() dto: UpdateNameDto) {
    return this.usersService.updateName(userId, dto);
  }
}

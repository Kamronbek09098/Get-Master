import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
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

  @Patch('me/name')
  updateName(@CurrentUser('sub') userId: string, @Body() dto: UpdateNameDto) {
    return this.usersService.updateName(userId, dto);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UpdateNameDto } from './dto/update-name.dto';
import { ERRORS } from '../../common/constants/error-messages';

@Injectable()
export class UsersService {
  constructor(private readonly db: PrismaService) {}

  async findMe(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        accountNumber: true,
        phone: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        status: true,
        phoneVerifiedAt: true,
        createdAt: true,
        userRoles: { select: { role: true } },
        masterProfile: { select: { id: true, status: true, verification: true } },
      },
    });
    if (!user) {
      throw new NotFoundException(ERRORS.USER_NOT_FOUND);
    }

    return {
      ...user,
      roles: user.userRoles.map((item) => item.role),
      userRoles: undefined,
    };
  }

  async updateName(userId: string, dto: UpdateNameDto) {
    await this.db.user.update({
      where: { id: userId },
      data: { firstName: dto.firstName.trim(), lastName: dto.lastName.trim() },
    });
    return this.findMe(userId);
  }
}

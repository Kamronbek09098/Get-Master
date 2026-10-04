import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ERRORS } from '../../common/constants/error-messages';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { MasterService } from './master.service';

const MAX_FAVORITES = 100;

/** Mijozning saqlangan ustalari. */
@Injectable()
export class FavoriteService {
  constructor(
    private readonly db: PrismaService,
    private readonly masters: MasterService,
  ) {}

  async list(customerId: string) {
    const rows = await this.db.favoriteMaster.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: { masterId: true },
      take: MAX_FAVORITES,
    });
    return this.masters.findPublicByIds(rows.map((row) => row.masterId));
  }

  async add(customerId: string, masterId: string) {
    const [master] = await this.masters.findPublicByIds([masterId]);
    if (!master) throw new NotFoundException(ERRORS.MASTER_NOT_FOUND);
    const existing = await this.db.favoriteMaster.findUnique({ where: { customerId_masterId: { customerId, masterId } } });
    if (!existing) {
      const count = await this.db.favoriteMaster.count({ where: { customerId } });
      if (count >= MAX_FAVORITES) throw new ConflictException(ERRORS.MAX_FAVORITE_MASTERS(MAX_FAVORITES));
      await this.db.favoriteMaster.upsert({
        where: { customerId_masterId: { customerId, masterId } },
        create: { customerId, masterId },
        update: {},
      });
    }
    return { saved: true };
  }

  async remove(customerId: string, masterId: string) {
    const result = await this.db.favoriteMaster.deleteMany({ where: { customerId, masterId } });
    if (result.count === 0) throw new NotFoundException(ERRORS.MASTER_NOT_FOUND);
    return { saved: false };
  }
}

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ERRORS } from '../../common/constants/error-messages';

@Injectable()
export class BookingService {
  constructor(private readonly db: PrismaService) {}

  async findOne(userId: string, bookingId: string) {
    const booking = await this.db.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException(ERRORS.BOOKING_NOT_FOUND);

    const masterProfile = await this.db.masterProfile.findUnique({ where: { userId } });
    if (masterProfile && booking.customerId === userId && booking.masterId === masterProfile.id) {
      throw new NotFoundException(ERRORS.BOOKING_NOT_FOUND);
    }
    const isParticipant = booking.customerId === userId || booking.masterId === masterProfile?.id;
    if (!isParticipant) throw new ForbiddenException(ERRORS.NOT_BOOKING_PARTICIPANT);

    return booking;
  }

  async findAll(userId: string) {
    const masterProfile = await this.db.masterProfile.findUnique({ where: { userId } });
    const conditions: Array<{ customerId?: string; masterId?: string }> = [{ customerId: userId }];
    if (masterProfile) {
      conditions.push({ masterId: masterProfile.id });
    }

    const rows = await this.db.booking.findMany({
      where: { OR: conditions },
      include: { order: { select: { id: true, status: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.filter((row) => !(row.customerId === userId && row.masterId === masterProfile?.id));
  }
}

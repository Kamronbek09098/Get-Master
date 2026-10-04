import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { MasterTimeUnavailableException } from '../../common/exceptions/business.exception';
import { fitsSchedule, toMinutes } from '../../common/utils/schedule';
import { CreateAvailabilityDto, UpdateAvailabilityDto } from './dto/availability.dto';
import { ERRORS } from '../../common/constants/error-messages';

const MAX_WINDOWS_PER_MASTER = 50;

type WindowShape = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
};

function rangesOverlap(a: WindowShape, b: WindowShape): boolean {
  const aEndsBeforeB = a.effectiveUntil && b.effectiveFrom && a.effectiveUntil < b.effectiveFrom;
  const bEndsBeforeA = b.effectiveUntil && a.effectiveFrom && b.effectiveUntil < a.effectiveFrom;
  return !(aEndsBeforeB || bEndsBeforeA);
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly db: PrismaService) {}

  findAll(masterId: string) {
    return this.db.masterAvailability.findMany({
      where: { masterId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  /** Ommaviy ish jadvali: faqat hozir amal qiladigan, band emas deb belgilangan oynalar. */
  findPublic(masterId: string) {
    const now = new Date();
    return this.db.masterAvailability.findMany({
      where: {
        masterId,
        isAvailable: true,
        AND: [{ OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }] }, { OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: now } }] }],
      },
      select: { dayOfWeek: true, startTime: true, endTime: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async create(masterId: string, dto: CreateAvailabilityDto) {
    const candidate = this.toShape(dto);
    return this.db.$transaction(async (tx) => {
      await this.lockMaster(tx, masterId);
      const existing = await tx.masterAvailability.findMany({ where: { masterId } });
      if (existing.length >= MAX_WINDOWS_PER_MASTER) {
        throw new ConflictException(ERRORS.MAX_AVAILABILITY_WINDOWS(MAX_WINDOWS_PER_MASTER));
      }
      this.assertNoOverlap(existing, candidate);
      return tx.masterAvailability.create({ data: { masterId, ...candidate } });
    });
  }

  async update(masterId: string, id: string, dto: UpdateAvailabilityDto) {
    return this.db.$transaction(async (tx) => {
      await this.lockMaster(tx, masterId);
      const current = await tx.masterAvailability.findFirst({ where: { id, masterId } });
      if (!current) throw new NotFoundException(ERRORS.AVAILABILITY_NOT_FOUND);
      const candidate = this.toShape({
        dayOfWeek: dto.dayOfWeek ?? current.dayOfWeek,
        startTime: dto.startTime ?? current.startTime,
        endTime: dto.endTime ?? current.endTime,
        isAvailable: dto.isAvailable ?? current.isAvailable,
        effectiveFrom: dto.effectiveFrom ?? current.effectiveFrom ?? undefined,
        effectiveUntil: dto.effectiveUntil ?? current.effectiveUntil ?? undefined,
      });
      const others = await tx.masterAvailability.findMany({ where: { masterId, id: { not: id } } });
      this.assertNoOverlap(others, candidate);
      return tx.masterAvailability.update({ where: { id }, data: candidate });
    });
  }

  async remove(masterId: string, id: string): Promise<{ deleted: true }> {
    const result = await this.db.masterAvailability.deleteMany({ where: { id, masterId } });
    if (result.count === 0) throw new NotFoundException(ERRORS.AVAILABILITY_NOT_FOUND);
    return { deleted: true };
  }

  async assertBookable(
    tx: Prisma.TransactionClient,
    masterId: string,
    start: Date | null,
    minutes: number,
  ): Promise<void> {
    const master = await tx.masterProfile.findUnique({
      where: { id: masterId },
      select: { status: true, isPaused: true, availability: true },
    });
    if (!master || master.isPaused || master.status === 'SUSPENDED' || master.status === 'RESTRICTED') {
      throw new MasterTimeUnavailableException();
    }
    if (!start) return;
    const end = new Date(start.getTime() + minutes * 60_000);
    if (!fitsSchedule(master.availability, start, end)) throw new MasterTimeUnavailableException();
  }

  private toShape(dto: CreateAvailabilityDto): WindowShape {
    if (toMinutes(dto.startTime) >= toMinutes(dto.endTime)) {
      throw new BadRequestException(ERRORS.START_BEFORE_END);
    }
    if (dto.effectiveFrom && dto.effectiveUntil && dto.effectiveFrom > dto.effectiveUntil) {
      throw new BadRequestException(ERRORS.EFFECTIVE_RANGE_INVALID);
    }
    return {
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
      isAvailable: dto.isAvailable ?? true,
      effectiveFrom: dto.effectiveFrom ?? null,
      effectiveUntil: dto.effectiveUntil ?? null,
    };
  }

  private assertNoOverlap(existing: WindowShape[], candidate: WindowShape): void {
    const clash = existing.some(
      (w) =>
        w.dayOfWeek === candidate.dayOfWeek &&
        rangesOverlap(w, candidate) &&
        toMinutes(w.startTime) < toMinutes(candidate.endTime) &&
        toMinutes(candidate.startTime) < toMinutes(w.endTime),
    );
    if (clash) throw new ConflictException(ERRORS.AVAILABILITY_OVERLAP);
  }

  private async lockMaster(tx: Prisma.TransactionClient, masterId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM master_profiles WHERE id = ${masterId}::uuid FOR UPDATE`;
  }
}

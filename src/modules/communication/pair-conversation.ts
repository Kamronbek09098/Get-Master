import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

/** Bir juftlik (mijoz + usta) uchun yagona suhbat kaliti: ikkala foydalanuvchi ID si tartiblab birlashtiriladi. */
export const pairKey = (a: string, b: string): string => [a, b].sort().join(':');

/** Ikki foydalanuvchi o‘rtasidagi mavjud suhbat (SUPPORT dan tashqari): avval kalit bo‘yicha, bo‘lmasa ishtirokchilar bo‘yicha. */
export async function findPairConversation(db: Db, a: string, b: string) {
  const byKey = await db.conversation.findUnique({ where: { directKey: pairKey(a, b) }, include: { order: { select: { status: true } } } });
  if (byKey) return byKey;
  return db.conversation.findFirst({
    where: { type: { not: 'SUPPORT' }, AND: [{ participants: { some: { userId: a } } }, { participants: { some: { userId: b } } }] },
    include: { order: { select: { status: true } } },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Buyurtma suhbatini ochadi: juftlik uchun suhbat allaqachon bo‘lsa — yangisi YARATILMAYDI, buyurtma o‘shanga bog‘lanadi
 * (suhbat eng so‘nggi buyurtmaga ko‘rsatadi, avvalgi xabarlar saqlanadi). Bo‘lmasa — yangi suhbat (kalit bilan) yaratiladi.
 */
export async function attachOrderToPairConversation(db: Db, input: { orderId: string; customerId: string; masterUserId: string }): Promise<string> {
  const key = pairKey(input.customerId, input.masterUserId);
  // Bir juftlikning parallel buyurtmalari bir vaqtda ikkita suhbat yaratmasligi uchun: tranzaksiya oxirigacha juftlik bo‘yicha qulf.
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  const existing = await findPairConversation(db, input.customerId, input.masterUserId);
  if (existing) {
    await db.conversation.update({ where: { id: existing.id }, data: { orderId: input.orderId, type: 'ORDER', directKey: existing.directKey ?? key, updatedAt: new Date() } });
    await db.conversationParticipant.updateMany({ where: { conversationId: existing.id }, data: { deletedAt: null } });
    return existing.id;
  }
  const created = await db.conversation.create({
    data: {
      type: 'ORDER',
      orderId: input.orderId,
      directKey: key,
      participants: {
        create: [
          { userId: input.customerId, roles: ['CUSTOMER'] },
          { userId: input.masterUserId, roles: ['MASTER'] },
        ],
      },
    },
  });
  return created.id;
}

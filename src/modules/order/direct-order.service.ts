import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { AvailabilityService } from '../master/availability.service';
import { ERRORS } from '../../common/constants/error-messages';
import { CreateDirectOrderDto } from './dto/create-direct-order.dto';
import { assertPhoneVerified } from '../../common/utils/phone-gate';

const DEFAULT_JOB_MINUTES = 60;
const OFFER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Suhbat ichida mijoz ustaga buyurtma yuboradi. Ichkarida odatdagi zanjir yaratiladi
 * (so‘rov → taklif → bron → buyurtma «Band qilindi»), shuning uchun usta uni oddiy buyurtmadek
 * qabul qiladi va oxirigacha bajaradi. Buyurtma suhbatga «buyurtma kartasi» sifatida tushadi.
 */
@Injectable()
export class DirectOrderService {
  constructor(
    private readonly db: PrismaService,
    private readonly outbox: OutboxService,
    private readonly availability: AvailabilityService,
  ) {}

  async create(customerId: string, dto: CreateDirectOrderDto) {
    await assertPhoneVerified(this.db, customerId);
    const participants = await this.db.conversationParticipant.findMany({ where: { conversationId: dto.conversationId }, select: { userId: true } });
    if (!participants.some((p) => p.userId === customerId)) throw new ForbiddenException(ERRORS.NOT_CONVERSATION_PARTICIPANT);
    const counterpartId = participants.find((p) => p.userId !== customerId)?.userId;
    const master = counterpartId ? await this.db.masterProfile.findUnique({ where: { userId: counterpartId } }) : null;
    if (!master) throw new BadRequestException('Buyurtmani faqat usta bilan suhbatdan yuborish mumkin');
    if (master.userId === customerId) throw new ForbiddenException(ERRORS.SELF_DEALING);
    if (master.verification !== 'VERIFIED' || master.isPaused || master.status === 'SUSPENDED' || master.status === 'RESTRICTED') {
      throw new BadRequestException('Usta hozir buyurtma qabul qila olmaydi');
    }

    // Rejim: berilmasa — usta faqat o‘z joyida ishlasa AT_MASTER, aks holda AT_CUSTOMER.
    const serviceMode = dto.serviceMode ?? (master.serviceModes.includes('AT_CUSTOMER') ? 'AT_CUSTOMER' : 'AT_MASTER');
    if (!master.serviceModes.includes(serviceMode)) throw new BadRequestException(ERRORS.CATEGORY_MODE_UNSUPPORTED);
    const start = dto.scheduledStartAt ? new Date(dto.scheduledStartAt) : null;
    if (start && start.getTime() <= Date.now()) throw new BadRequestException(ERRORS.AVAILABLE_AT_IN_FUTURE);
    const address = dto.addressId ? await this.db.address.findFirst({ where: { id: dto.addressId, userId: customerId } }) : null;
    if (dto.addressId && !address) throw new NotFoundException('Manzil topilmadi');

    const price = Math.round(dto.price * 100) / 100;
    return this.db.$transaction(async (tx) => {
      await this.availability.assertBookable(tx, master.id, start, DEFAULT_JOB_MINUTES);

      const request = await tx.problemRequest.create({
        data: {
          customerId,
          title: dto.title.trim(),
          description: dto.description.trim(),
          serviceMode,
          addressId: address?.id,
          latitude: address?.latitude,
          longitude: address?.longitude,
          preferredStartAt: start,
          status: 'BOOKED',
          submittedAt: new Date(),
        },
      });
      const offer = await tx.offer.create({
        data: { requestId: request.id, masterId: master.id, price, message: 'Suhbat orqali yuborilgan buyurtma', availableAt: start, status: 'ACCEPTED', expiresAt: new Date(Date.now() + OFFER_TTL_MS) },
      });
      const booking = await tx.booking.create({
        data: {
          requestId: request.id,
          offerId: offer.id,
          customerId,
          masterId: master.id,
          scheduledStartAt: start,
          agreedPrice: price,
          currency: offer.currency,
          locationSnapshot: serviceMode === 'AT_MASTER' ? { atMaster: true, latitude: master.latitude, longitude: master.longitude, addressLine: master.placeAddress, title: master.workPlace } : address ? { latitude: address.latitude, longitude: address.longitude, addressLine: address.addressLine, city: address.city, district: address.district } : undefined,
        },
      });
      const order = await tx.order.create({
        data: { bookingId: booking.id, customerId, masterId: master.id, status: 'BOOKED', originalAmount: price, finalAmount: price, currency: offer.currency },
      });
      await tx.orderStatusHistory.create({ data: { orderId: order.id, actorId: customerId, actorType: 'CUSTOMER', oldStatus: null, newStatus: 'BOOKED', reason: null } });

      const amount = price.toLocaleString('ru-RU');
      const message = await tx.message.create({
        data: { conversationId: dto.conversationId, senderId: customerId, senderPanel: 'CUSTOMER', type: 'ORDER', orderId: order.id, text: `Buyurtma: ${request.title} — ${amount} ${offer.currency}` },
        select: { id: true },
      });
      await tx.conversation.update({ where: { id: dto.conversationId }, data: { updatedAt: new Date(), orderId: order.id, type: 'ORDER' } });
      await tx.conversationParticipant.update({ where: { conversationId_userId: { conversationId: dto.conversationId, userId: customerId } }, data: { lastReadAt: new Date() } });

      await this.outbox.emit(tx, {
        eventName: 'order.booked',
        aggregateType: 'Order',
        aggregateId: order.id,
        payload: { orderId: order.id, masterUserId: master.userId, customerId, direct: true, title: request.title, amount: String(price), currency: offer.currency },
        createdById: customerId,
      });
      return { order, messageId: message.id };
    });
  }
}

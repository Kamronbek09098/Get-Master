import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AIClassification, Prisma, RequestStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { AiClassificationProvider } from '../../infrastructure/ai/ai-classification.provider';
import type { AiClassifyResult } from '../../infrastructure/ai/ai-classification.types';
import { ERRORS } from '../../common/constants/error-messages';

const AUTO_ACCEPT_THRESHOLD = 0.75;
const SUGGESTION_THRESHOLD = 0.4;

const CLASSIFIABLE_STATUSES: RequestStatus[] = ['DRAFT', 'SUBMITTED', 'MATCHING', 'OFFERS_RECEIVED'];

@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly storage: StorageService,
    private readonly aiProvider: AiClassificationProvider,
    private readonly outbox: OutboxService,
  ) {}

  async classify(requestId: string): Promise<void> {
    const request = await this.db.problemRequest.findUnique({ where: { id: requestId } });
    if (!request || !CLASSIFIABLE_STATUSES.includes(request.status)) return;

    if (!this.aiProvider.isConfigured()) {
      await this.recordResult(requestId, null);
      return;
    }

    let result: AiClassifyResult;
    try {
      const attachmentUrls = await this.getAttachmentSignedUrls(requestId);
      result = await this.aiProvider.classify({
        requestId,
        title: request.title,
        description: request.description,
        attachmentUrls,
        locale: 'uz',
      });
    } catch (error) {
      this.logger.warn(`${requestId} so‘rovi uchun AI tasniflash mavjud emas: ${(error as Error).message}`);
      await this.recordResult(requestId, null);
      return;
    }

    await this.recordResult(requestId, result);
  }

  private async getAttachmentSignedUrls(requestId: string): Promise<string[]> {
    const assets = await this.db.mediaAsset.findMany({
      where: { linkedResourceType: 'ProblemRequest', linkedResourceId: requestId, status: 'READY' },
      select: { id: true, originalKey: true },
      take: 10,
    });
    const urls: string[] = [];
    for (const asset of assets) {
      if (!asset.originalKey) continue;
      urls.push(await this.storage.getSignedGetUrl(asset.originalKey, 900));
    }
    return urls;
  }

  private async recordResult(requestId: string, result: AiClassifyResult | null): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.aIClassification.create({
        data: {
          requestId,
          categoryId: result?.categoryId ?? undefined,
          serviceId: result?.serviceId ?? undefined,
          confidence: result?.confidence,
          possibleQuestions: result ? (result.possibleQuestions as Prisma.InputJsonValue) : undefined,
          result: result ? (result as unknown as Prisma.InputJsonValue) : undefined,
        },
      });

      if (result && result.confidence >= AUTO_ACCEPT_THRESHOLD && result.categoryId && result.serviceId) {
        const service = await tx.service.findUnique({ where: { id: result.serviceId } });
        if (service && service.isActive && service.categoryId === result.categoryId) {
          await tx.problemRequest.update({
            where: { id: requestId },
            data: { categoryId: result.categoryId, serviceId: result.serviceId },
          });
        }
      }
      if (result && result.confidence >= SUGGESTION_THRESHOLD && result.confidence < AUTO_ACCEPT_THRESHOLD) {
        this.logger.log(`${requestId} so‘rovi uchun AI taklifi saqlandi (ishonch: ${result.confidence}), mijoz tasdig‘i kutilmoqda`);
      }
    });
  }

  async getLatest(customerId: string, requestId: string): Promise<AIClassification | null> {
    await this.findOwnedRequest(customerId, requestId);
    return this.db.aIClassification.findFirst({ where: { requestId }, orderBy: { createdAt: 'desc' } });
  }

  async setManual(customerId: string, requestId: string, serviceId: string): Promise<AIClassification> {
    const request = await this.findOwnedRequest(customerId, requestId);
    if (!CLASSIFIABLE_STATUSES.includes(request.status)) {
      throw new ForbiddenException(ERRORS.REQUEST_CANNOT_RECLASSIFY);
    }

    const service = await this.db.service.findUnique({ where: { id: serviceId } });
    if (!service || !service.isActive) throw new NotFoundException(ERRORS.SERVICE_NOT_FOUND);

    return this.db.$transaction(async (tx) => {
      await tx.problemRequest.update({
        where: { id: requestId },
        data: { categoryId: service.categoryId, serviceId: service.id },
      });
      const classification = await tx.aIClassification.create({
        data: {
          requestId,
          categoryId: service.categoryId,
          serviceId: service.id,
          confidence: 1,
          isAccepted: false,
          correctedAt: new Date(),
        },
      });
      const submitted = request.status !== 'DRAFT';
      if (submitted && request.serviceId !== service.id) {
        await this.outbox.emit(tx, {
          eventName: 'matching.requested',
          aggregateType: 'ProblemRequest',
          aggregateId: requestId,
          payload: { requestId },
          createdById: customerId,
        });
      }
      return classification;
    });
  }

  private async findOwnedRequest(customerId: string, requestId: string) {
    const request = await this.db.problemRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException(ERRORS.REQUEST_NOT_FOUND);
    if (request.customerId !== customerId) throw new ForbiddenException(ERRORS.NOT_REQUEST_OWNER);
    return request;
  }
}

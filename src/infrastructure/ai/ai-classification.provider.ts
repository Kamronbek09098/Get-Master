import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiClassifyInput, AiClassifyResult } from './ai-classification.types';
import { ERRORS } from '../../common/constants/error-messages';

const RETRY_DELAYS_MS = [2_000, 8_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class AiClassificationProvider implements OnModuleInit {
  private readonly logger = new Logger(AiClassificationProvider.name);
  private configured = false;
  private url = '';
  private apiKey = '';
  private timeoutMs = 10_000;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.url = this.config.get<string>('ai.classificationUrl', '');
    this.apiKey = this.config.get<string>('ai.classificationApiKey', '');
    this.timeoutMs = this.config.get<number>('ai.timeoutMs', 10_000);
    this.configured = !!this.url;
    if (!this.configured) {
      this.logger.warn(
        'AI_CLASSIFICATION_URL sozlanmagan — AI tasniflash O‘CHIRILGAN. Har bir so‘rovda kategoriya qo‘lda tanlanadi.',
      );
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async classify(input: AiClassifyInput): Promise<AiClassifyResult> {
    if (!this.configured) {
      throw new Error(ERRORS.AI_NOT_CONFIGURED);
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        return await this.callOnce(input);
      } catch (error) {
        lastError = error;
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay === undefined) break;
        this.logger.warn(
          `${input.requestId} so‘rovi uchun AI tasniflash ${attempt + 1}-urinishi bajarilmadi, ${delay}ms dan keyin qayta uriniladi: ${(error as Error).message}`,
        );
        await sleep(delay);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(ERRORS.AI_FAILED);
  }

  private async callOnce(input: AiClassifyInput): Promise<AiClassifyResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(ERRORS.AI_HTTP_ERROR(response.status));
      }

      const body = (await response.json()) as Partial<AiClassifyResult>;
      return this.normalize(body);
    } finally {
      clearTimeout(timer);
    }
  }

  private normalize(body: Partial<AiClassifyResult>): AiClassifyResult {
    const confidence = typeof body.confidence === 'number' && body.confidence >= 0 && body.confidence <= 1 ? body.confidence : 0;
    return {
      categoryId: typeof body.categoryId === 'string' ? body.categoryId : null,
      serviceId: typeof body.serviceId === 'string' ? body.serviceId : null,
      confidence,
      possibleQuestions: Array.isArray(body.possibleQuestions) ? body.possibleQuestions.filter((q) => typeof q === 'string') : [],
      alternatives: Array.isArray(body.alternatives)
        ? body.alternatives.filter(
            (alt): alt is { serviceId: string; confidence: number } =>
              !!alt && typeof alt.serviceId === 'string' && typeof alt.confidence === 'number',
          )
        : [],
    };
  }
}

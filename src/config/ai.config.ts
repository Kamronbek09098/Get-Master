import { registerAs } from '@nestjs/config';

export default registerAs('ai', () => ({
  classificationUrl: process.env.AI_CLASSIFICATION_URL || '',
  classificationApiKey: process.env.AI_CLASSIFICATION_API_KEY || '',
  timeoutMs: Number(process.env.AI_CLASSIFICATION_TIMEOUT_MS ?? 10_000),
}));

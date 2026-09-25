import { Global, Module } from '@nestjs/common';
import { AiClassificationProvider } from './ai-classification.provider';

@Global()
@Module({
  providers: [AiClassificationProvider],
  exports: [AiClassificationProvider],
})
export class AiClassificationModule {}

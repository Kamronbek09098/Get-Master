import { Module } from '@nestjs/common';
import { AiClassificationModule } from '../../infrastructure/ai/ai-classification.module';
import { ClassificationController } from './classification.controller';
import { ClassificationService } from './classification.service';

@Module({
  imports: [AiClassificationModule],
  controllers: [ClassificationController],
  providers: [ClassificationService],
  exports: [ClassificationService],
})
export class ClassificationModule {}

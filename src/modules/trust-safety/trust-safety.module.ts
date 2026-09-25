import { Module } from '@nestjs/common';
import { TrustSafetyController } from './trust-safety.controller';
import { TrustSafetyService } from './trust-safety.service';

@Module({
  controllers: [TrustSafetyController],
  providers: [TrustSafetyService],
})
export class TrustSafetyModule {}

import { Global, Module } from '@nestjs/common';
import { PaymentProviderAdapter } from './payment.provider';

@Global()
@Module({
  providers: [PaymentProviderAdapter],
  exports: [PaymentProviderAdapter],
})
export class PaymentProviderModule {}

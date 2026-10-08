import { Module } from '@nestjs/common';
import { CustomerController, CustomerPublicController } from './customer.controller';
import { CustomerService } from './customer.service';

@Module({
  controllers: [CustomerController, CustomerPublicController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}

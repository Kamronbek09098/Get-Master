import { Module } from '@nestjs/common';
import { CustomerModule } from '../customer/customer.module';
import { ServiceModule } from '../service/service.module';
import { RequestController } from './request.controller';
import { RequestService } from './request.service';

@Module({
  imports: [ServiceModule, CustomerModule],
  controllers: [RequestController],
  providers: [RequestService],
  exports: [RequestService],
})
export class RequestModule {}

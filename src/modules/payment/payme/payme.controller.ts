import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { Public } from '../../../common/decorators/public.decorator';
import { RawResponse } from '../../../common/decorators/raw-response.decorator';
import { PaymeService } from './payme.service';
import { PaymeRpcRequest } from './payme.types';

@Controller('payments/payme')
export class PaymeController {
  constructor(private readonly payme: PaymeService) {}

  @Public()
  @RawResponse()
  @Post()
  @HttpCode(200)
  rpc(@Body() body: PaymeRpcRequest, @Headers('authorization') authHeader?: string) {
    return this.payme.handleRpc(body, authHeader);
  }
}

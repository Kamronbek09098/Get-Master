import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Public } from '../../../common/decorators/public.decorator';
import { RawResponse } from '../../../common/decorators/raw-response.decorator';
import { ClickService } from './click.service';
import { ClickCallbackBody } from './click.types';

@Controller('payments/click')
export class ClickController {
  constructor(private readonly click: ClickService) {}

  @Public()
  @RawResponse()
  @Post('callback')
  @HttpCode(200)
  callback(@Body() body: ClickCallbackBody) {
    return this.click.handleCallback(body);
  }
}

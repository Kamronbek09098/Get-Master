import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RawResponse } from '../../common/decorators/raw-response.decorator';
import { panelOf } from '../../common/utils/panel';
import { CallEventsService } from './call-events.service';
import { CallRecordingService } from './call-recording.service';
import { CallService } from './call.service';
import { CallSignalDto, StartCallDto } from './dto/call.dto';

@Controller('calls')
export class CallController {
  constructor(
    private readonly calls: CallService,
    private readonly events: CallEventsService,
    private readonly recordings: CallRecordingService,
  ) {}

  @Get('ice-servers')
  iceServers(@CurrentUser('sub') userId: string) {
    return this.calls.iceServers(userId);
  }

  @Get('current')
  current(@CurrentUser('sub') userId: string, @Req() req: Request) {
    return this.calls.current(userId, panelOf(req));
  }

  /** Server-Sent Events: kiruvchi qo‘ng‘iroq, qabul/rad, signal va tugash hodisalari (fetch oqimi sarlavhalar bilan ochiladi). */
  @Get('events')
  @RawResponse()
  async stream(@CurrentUser('sub') userId: string, @Req() req: Request, @Res() res: Response) {
    const panel = panelOf(req);
    const client = this.events.attach(userId, panel, res, () => undefined);
    this.events.write(client, 'ready', { at: Date.now() });
    // Ulanganda jiringlayotgan/davom etayotgan qo‘ng‘iroq bo‘lsa — darhol qayta yuboriladi (sahifa yangilangan yoki oqim uzilgan bo‘lishi mumkin).
    const current = await this.calls.current(userId, panel);
    if (current) {
      this.events.write(client, 'call.current', current);
    }
  }

  @Post()
  @RateLimit({ policy: 'call', scope: 'user' })
  start(@CurrentUser('sub') userId: string, @Body() dto: StartCallDto, @Req() req: Request) {
    return this.calls.start(userId, panelOf(req), dto.conversationId, dto.mode);
  }

  /** Ishtirokchi o‘z yozuvini (webm) yuboradi (tana — xom fayl); yozuv Telegram guruhiga uzatiladi, tizimda saqlanmaydi. */
  @Post(':id/recording')
  @RateLimit({ policy: 'callSignal', scope: 'user' })
  uploadRecording(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.recordings.forward(userId, id, req);
  }

  @Post(':id/accept')
  accept(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.calls.accept(userId, id);
  }

  @Post(':id/decline')
  decline(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.calls.decline(userId, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.calls.cancel(userId, id);
  }

  @Post(':id/end')
  end(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: { reason?: string } | undefined) {
    return this.calls.end(userId, id, body?.reason);
  }

  @Post(':id/ping')
  @RateLimit({ policy: 'callSignal', scope: 'user' })
  ping(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.calls.ping(userId, id);
  }

  @Post(':id/signal')
  @RateLimit({ policy: 'callSignal', scope: 'user' })
  signal(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CallSignalDto) {
    return this.calls.signal(userId, id, dto);
  }
}

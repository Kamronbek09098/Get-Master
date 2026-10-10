import { ParseUUIDPipe } from '../../common/validators/any-uuid';
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { CursorQueryDto } from '../../common/dto/cursor-query.dto';
import { panelOf } from '../../common/utils/panel';
import { CommunicationService } from './communication.service';
import { OpenConversationDto, OpenDirectConversationDto } from './dto/conversation.dto';
import { EditMessageDto, ReactMessageDto, SendMessageDto } from './dto/message.dto';
import { ReplyAccessDto } from './dto/reply-access.dto';

@Controller('conversations')
export class CommunicationController {
  constructor(private readonly communicationService: CommunicationService) {}

  @Post()
  create(@CurrentUser('sub') userId: string, @Body() dto: OpenConversationDto, @Req() req: Request) {
    return this.communicationService.create(userId, dto.orderId, panelOf(req));
  }

  @Post('direct')
  @Roles(Role.CUSTOMER)
  createDirect(@CurrentUser('sub') userId: string, @Body() dto: OpenDirectConversationDto, @Req() req: Request) {
    return this.communicationService.openDirect(userId, dto.masterId, panelOf(req));
  }

  /** Administrator foydalanuvchi bilan suhbat ochadi (yoki mavjudini qaytaradi). */
  @Post('support/:userId')
  @Roles(Role.ADMIN)
  openSupport(@CurrentUser('sub') adminId: string, @Param('userId', ParseUUIDPipe) userId: string, @Req() req: Request) {
    return this.communicationService.openSupport(adminId, userId, panelOf(req));
  }

  /** Administrator: foydalanuvchi shu suhbatga yozishi mumkinmi — belgilaydi. */
  @Patch(':id/reply-access')
  @Roles(Role.ADMIN)
  setReplyAccess(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyAccessDto,
    @Req() req: Request,
  ) {
    return this.communicationService.setUserCanReply(adminId, id, dto.allowed, panelOf(req));
  }

  @Get()
  findAll(@CurrentUser('sub') userId: string, @Query() query: CursorQueryDto, @Req() req: Request) {
    return this.communicationService.findAll(userId, query, panelOf(req));
  }

  @Get('unread-count')
  unreadCount(@CurrentUser('sub') userId: string, @Req() req: Request) {
    return this.communicationService.unreadTotal(userId, panelOf(req));
  }

  @Get(':id')
  findOne(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.communicationService.findOne(userId, id, panelOf(req));
  }

  @Get(':id/messages')
  findAllMessages(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CursorQueryDto,
    @Req() req: Request,
  ) {
    return this.communicationService.findAllMessages(userId, id, query, panelOf(req));
  }

  @Post(':id/messages')
  @RateLimit({ policy: 'chat', scope: 'user' })
  createMessage(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
    @Req() req: Request,
  ) {
    return this.communicationService.createMessage(userId, id, dto, panelOf(req));
  }

  @Patch(':id/messages/:messageId')
  updateMessage(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: EditMessageDto,
    @Req() req: Request,
  ) {
    return this.communicationService.updateMessage(userId, id, messageId, dto, panelOf(req));
  }

  @Put(':id/messages/:messageId/reaction')
  @RateLimit({ policy: 'chat', scope: 'user' })
  react(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: ReactMessageDto,
    @Req() req: Request,
  ) {
    return this.communicationService.react(userId, id, messageId, dto.emoji ?? null, panelOf(req));
  }

  @Delete(':id/messages/:messageId')
  removeMessage(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Query('scope') scope: string | undefined,
    @Req() req: Request,
  ) {
    return this.communicationService.removeMessage(userId, id, messageId, panelOf(req), scope === 'me' ? 'me' : 'all');
  }

  @Post(':id/read')
  markRead(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.communicationService.markRead(userId, id, panelOf(req));
  }

  /** ?scope=all — ikkala tomondan butunlay o‘chirish (Telegramdagidek); aks holda faqat mening ro‘yxatimdan. */
  @Delete(':id')
  deleteConversation(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('scope') scope: string | undefined,
    @Req() req: Request,
  ) {
    return scope === 'all'
      ? this.communicationService.deleteForEveryone(userId, id, panelOf(req))
      : this.communicationService.deleteForMe(userId, id, panelOf(req));
  }
}

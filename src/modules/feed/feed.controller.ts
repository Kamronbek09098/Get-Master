import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateCommentDto, CreateWorkPostDto, FeedQueryDto } from './dto/feed.dto';
import { FeedService } from './feed.service';

const apiBase = (req: Request) => {
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol).split(',')[0];
  const host = String(req.headers['x-forwarded-host'] ?? req.get('host')).split(',')[0];
  return `${proto}://${host}`;
};

/** Professional ish lentasi (Work Feed). */
@Controller('feed')
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get()
  list(@CurrentUser('sub') userId: string, @Query() query: FeedQueryDto, @Req() req: Request) {
    return this.feed.list(userId, query, apiBase(req));
  }

  @Get('mine')
  @Roles(Role.MASTER)
  mine(@CurrentUser('sub') userId: string, @Req() req: Request) {
    return this.feed.mine(userId, apiBase(req));
  }

  @Post()
  @Roles(Role.MASTER)
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateWorkPostDto) {
    return this.feed.create(userId, dto);
  }

  @Put('masters/:masterId/follow')
  follow(@CurrentUser('sub') userId: string, @Param('masterId', ParseUUIDPipe) masterId: string) {
    return this.feed.setFollow(userId, masterId, true);
  }

  @Delete('masters/:masterId/follow')
  unfollow(@CurrentUser('sub') userId: string, @Param('masterId', ParseUUIDPipe) masterId: string) {
    return this.feed.setFollow(userId, masterId, false);
  }

  @Get(':id')
  findOne(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.feed.findOne(userId, id, apiBase(req));
  }

  @Delete(':id')
  @Roles(Role.MASTER)
  remove(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.feed.remove(userId, id);
  }

  @Post(':id/view')
  view(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.feed.view(userId, id);
  }

  @Post(':id/share')
  share(@Param('id', ParseUUIDPipe) id: string) {
    return this.feed.share(id);
  }

  @Put(':id/like')
  like(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.feed.setLike(userId, id, true);
  }

  @Delete(':id/like')
  unlike(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.feed.setLike(userId, id, false);
  }

  @Put(':id/save')
  save(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.feed.setSave(userId, id, true);
  }

  @Delete(':id/save')
  unsave(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.feed.setSave(userId, id, false);
  }

  @Get(':id/comments')
  comments(@Param('id', ParseUUIDPipe) id: string) {
    return this.feed.comments(id);
  }

  @Post(':id/comments')
  @RateLimit({ policy: 'chat', scope: 'user' })
  addComment(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateCommentDto) {
    return this.feed.addComment(userId, id, dto);
  }

  @Delete(':id/comments/:commentId')
  removeComment(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string, @Param('commentId', ParseUUIDPipe) commentId: string) {
    return this.feed.removeComment(userId, id, commentId);
  }
}

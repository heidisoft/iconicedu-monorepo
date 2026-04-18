import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Query,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  MessageSendFileInput,
  MessageSendFilesInput,
  MessageSendTextInput,
} from '@iconicedu/shared-types';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { MessagesService } from '@iconicedu/api/modules/messages/messages.service';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @UseGuards(AuthGuard)
  list(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('channelId') channelId: string,
    @Query('profileId') profileId: string,
    @Query('accountId') accountId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const accessToken = extractBearerToken(req.headers.authorization);
    return this.messagesService.getChannelMessages({
      accessToken,
      orgId,
      channelId,
      profileId,
      accountId,
      limit: limit ? Number(limit) : undefined,
      before,
    });
  }

  @Get('thread')
  @UseGuards(AuthGuard)
  listThread(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('channelId') channelId: string,
    @Query('threadId') threadId: string,
    @Query('parentMessageId') parentMessageId: string,
    @Query('profileId') profileId: string,
    @Query('accountId') accountId: string,
  ) {
    const accessToken = extractBearerToken(req.headers.authorization);
    return this.messagesService.getThreadMessages({
      accessToken,
      orgId,
      channelId,
      threadId,
      parentMessageId,
      profileId,
      accountId,
    });
  }

  @Post('text')
  @UseGuards(AuthGuard)
  sendText(@Req() req: AuthenticatedRequest, @Body() body: MessageSendTextInput) {
    const accessToken = extractBearerToken(req.headers.authorization);
    return this.messagesService.sendTextMessage(req.user.id, accessToken, body);
  }

  @Post('file')
  @UseGuards(AuthGuard)
  sendFile(@Req() req: AuthenticatedRequest, @Body() body: MessageSendFileInput) {
    const accessToken = extractBearerToken(req.headers.authorization);
    return this.messagesService.sendFileMessage(req.user.id, accessToken, body);
  }

  @Post('files')
  @UseGuards(AuthGuard)
  sendFiles(@Req() req: AuthenticatedRequest, @Body() body: MessageSendFilesInput) {
    const accessToken = extractBearerToken(req.headers.authorization);
    return this.messagesService.sendFilesMessage(req.user.id, accessToken, body);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { orgId: string; profileId: string },
  ) {
    const accessToken = extractBearerToken(req.headers.authorization);
    return this.messagesService.deleteMessage(accessToken, id, body);
  }
}

import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { MessageSendTextInput } from '@iconicedu/shared-types';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { MessagesService } from '@iconicedu/api/modules/messages/messages.service';

type AuthenticatedRequest = {
  user: { id: string };
  headers: { authorization?: string };
};

function extractBearerToken(authorization: string | undefined): string {
  const header = authorization?.trim() ?? '';
  if (!header.toLowerCase().startsWith('bearer ')) {
    throw new UnauthorizedException('Missing token');
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw new UnauthorizedException('Missing token');
  }
  return token;
}

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('text')
  @UseGuards(AuthGuard)
  sendText(@Req() req: AuthenticatedRequest, @Body() body: MessageSendTextInput) {
    const accessToken = extractBearerToken(req.headers.authorization);
    return this.messagesService.sendTextMessage(req.user.id, accessToken, body);
  }
}

import { Injectable } from '@nestjs/common';
import type {
  MessageSendFileInput,
  MessageSendFilesInput,
  MessageSendTextInput,
} from '@iconicedu/shared-types';
import {
  sendFileMessageWithSupabase,
  sendFilesMessageWithSupabase,
  sendTextMessageWithSupabase,
} from '@iconicedu/web/app/actions/messages';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';

@Injectable()
export class MessagesService {
  async sendTextMessage(
    authUserId: string,
    accessToken: string,
    input: MessageSendTextInput,
  ) {
    return sendTextMessageWithSupabase(input, {
      supabase: createSupabaseSessionClient(accessToken),
      serviceSupabase: createSupabaseServiceClient(),
      authUserId,
    });
  }

  async sendFileMessage(
    authUserId: string,
    accessToken: string,
    input: MessageSendFileInput,
  ) {
    return sendFileMessageWithSupabase(input, {
      supabase: createSupabaseSessionClient(accessToken),
      serviceSupabase: createSupabaseServiceClient(),
      authUserId,
    });
  }

  async sendFilesMessage(
    authUserId: string,
    accessToken: string,
    input: MessageSendFilesInput,
  ) {
    return sendFilesMessageWithSupabase(input, {
      supabase: createSupabaseSessionClient(accessToken),
      serviceSupabase: createSupabaseServiceClient(),
      authUserId,
    });
  }
}

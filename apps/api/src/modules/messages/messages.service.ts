import { Injectable } from '@nestjs/common';
import type { MessageSendTextInput } from '@iconicedu/shared-types';
import { sendTextMessageWithSupabase } from '@iconicedu/web/app/actions/messages';
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
}

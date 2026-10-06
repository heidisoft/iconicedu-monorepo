import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  type AnnotationContext,
  type AnnotationCommit,
  type AnnotationOperation,
} from '@iconicedu/shared-types';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
@Injectable()
export class ScreenAnnotationsService {
  private async user(accessToken: string) {
    const { data, error } = await createSupabaseSessionClient(accessToken).auth.getUser();
    if (error || !data.user) throw new ForbiddenException('Authentication required');
    return data.user.id;
  }
  private fail(message: string): never {
    if (message.includes('annotation_conflict'))
      throw new ConflictException('Annotation changed. Please try again.');
    if (message.includes('annotation_not_started'))
      throw new NotFoundException('The tutor has not opened annotations for this share');
    if (message.includes('annotation_forbidden') || message.includes('annotation_ended'))
      throw new ForbiddenException('Annotation access denied');
    if (message.includes('annotation_capacity'))
      throw new BadRequestException(
        'This annotation session is full. Start a new screen share.',
      );
    throw new InternalServerErrorException('Unable to synchronize annotations');
  }
  async context(
    token: string,
    sessionId: string,
    shareKey: string,
  ): Promise<AnnotationContext> {
    const userId = await this.user(token);
    const { data, error } = await createSupabaseServiceClient().rpc(
      'screen_annotation_context',
      { p_session: sessionId, p_user: userId, p_share: shareKey },
    );
    if (error) this.fail(error.message);
    return data as AnnotationContext;
  }
  async apply(
    token: string,
    roomId: string,
    operation: AnnotationOperation,
  ): Promise<AnnotationCommit> {
    const userId = await this.user(token);
    const { data, error } = await createSupabaseServiceClient().rpc(
      'screen_annotation_apply',
      { p_room: roomId, p_user: userId, p_operation: operation },
    );
    if (error) this.fail(error.message);
    return data as AnnotationCommit;
  }
}

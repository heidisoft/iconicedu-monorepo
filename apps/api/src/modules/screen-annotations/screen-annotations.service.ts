import { hashAnnotationToken } from './annotation-access';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  type AnnotationLaserPresence,
  type AnnotationLaserStroke,
  type AnnotationContext,
  type AnnotationPointerInput,
  type AnnotationPointerPresence,
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
    if (message.includes('annotation_guest_expired'))
      throw new ForbiddenException('Annotation access expired. Rejoin the meeting.');
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
  private guestHash(token: string) {
    if (!/^[\w-]{43}$/.test(token))
      throw new ForbiddenException('Annotation access expired. Rejoin the meeting.');
    return hashAnnotationToken(token);
  }
  async guestContext(
    token: string,
    sessionId: string,
    shareKey: string,
    includePresence = true,
  ): Promise<AnnotationContext> {
    const { data, error } = await createSupabaseServiceClient().rpc(
      'screen_annotation_guest_context',
      {
        p_session: sessionId,
        p_hash: this.guestHash(token),
        p_share: shareKey,
      },
    );
    if (error) this.fail(error.message);
    return includePresence
      ? this.withPresence(data as AnnotationContext)
      : (data as AnnotationContext);
  }
  private async withPresence(context: AnnotationContext): Promise<AnnotationContext> {
    const db = createSupabaseServiceClient();
    const [{ data, error }, laserRows] = await Promise.all([
      db
        .from('screen_annotation_pointers')
        .select('user_id, name, role, x, y, tool, color, expires_at')
        .eq('room_id', context.snapshot.roomId)
        .gt('expires_at', new Date().toISOString())
        .limit(128),
      db
        .from('screen_annotation_lasers')
        .select('user_id, strokes')
        .eq('room_id', context.snapshot.roomId)
        .gt('expires_at', new Date().toISOString())
        .limit(128),
    ]);
    if (error)
      throw new InternalServerErrorException('Unable to load participant pointers');
    const allowed = new Map(context.actors.map((actor) => [actor.userId, actor]));
    const pointers: AnnotationPointerPresence[] = (data ?? []).flatMap((pointer) => {
      const actor = allowed.get(pointer.user_id);
      if (
        !actor ||
        context.snapshot.ended ||
        (actor.role !== 'educator' && !context.snapshot.studentsEnabled)
      )
        return [];
      return [
        {
          userId: actor.userId,
          name: actor.name.trim() || 'Participant',
          point: { x: pointer.x, y: pointer.y },
          color: pointer.color,
          tool: pointer.tool as AnnotationPointerInput['tool'],
          expiresAt: new Date(pointer.expires_at).getTime(),
        },
      ];
    });
    if (laserRows.error)
      throw new InternalServerErrorException('Unable to load participant lasers');
    const lasers: AnnotationLaserPresence[] = (laserRows.data ?? []).flatMap((row) => {
      const actor = allowed.get(row.user_id);
      if (
        !actor ||
        context.snapshot.ended ||
        (actor.role !== 'educator' && !context.snapshot.studentsEnabled)
      )
        return [];
      return [
        {
          userId: actor.userId,
          strokes: (row.strokes as AnnotationLaserStroke[])
            .filter((stroke) => stroke.expiresAt > Date.now())
            .map((stroke) => ({
              ...stroke,
              object: {
                ...stroke.object,
                roomId: context.snapshot.roomId,
                shareSessionId: context.snapshot.roomId,
                creatorId: actor.userId,
                creatorName: actor.name,
                creatorRole: actor.role,
              },
            })),
        },
      ];
    });
    return { ...context, pointers, lasers };
  }
  async pointer(
    token: string,
    sessionId: string,
    shareKey: string,
    input: AnnotationPointerInput,
    guest = false,
  ) {
    const context = guest
      ? await this.guestContext(token, sessionId, shareKey, false)
      : await this.context(token, sessionId, shareKey, false);
    if (
      context.snapshot.ended ||
      (context.actor.role !== 'educator' && !context.snapshot.studentsEnabled)
    )
      throw new ForbiddenException('Annotation access denied');
    const { error } = await createSupabaseServiceClient()
      .from('screen_annotation_pointers')
      .upsert(
        {
          room_id: context.snapshot.roomId,
          user_id: context.actor.userId,
          name: context.actor.name.trim().slice(0, 100) || 'Participant',
          role: context.actor.role,
          x: input.point.x,
          y: input.point.y,
          tool: input.tool,
          color: input.color,
          expires_at: new Date(Date.now() + 3000).toISOString(),
        },
        { onConflict: 'room_id,user_id' },
      );
    if (error)
      throw new InternalServerErrorException('Unable to share participant pointer');
  }
  async laser(
    token: string,
    sessionId: string,
    shareKey: string,
    strokes: AnnotationLaserStroke[],
    guest = false,
  ) {
    const context = guest
      ? await this.guestContext(token, sessionId, shareKey, false)
      : await this.context(token, sessionId, shareKey, false);
    if (
      context.snapshot.ended ||
      (context.actor.role !== 'educator' && !context.snapshot.studentsEnabled)
    )
      throw new ForbiddenException('Annotation access denied');
    const now = Date.now();
    const { error } = await createSupabaseServiceClient()
      .from('screen_annotation_lasers')
      .upsert(
        {
          room_id: context.snapshot.roomId,
          user_id: context.actor.userId,
          strokes: strokes.filter((stroke) => stroke.expiresAt > now),
          expires_at: new Date(now + 4000).toISOString(),
        },
        { onConflict: 'room_id,user_id' },
      );
    if (error) throw new InternalServerErrorException('Unable to share laser');
  }
  async guestApply(
    token: string,
    roomId: string,
    operation: AnnotationOperation,
  ): Promise<AnnotationCommit> {
    const { data, error } = await createSupabaseServiceClient().rpc(
      'screen_annotation_guest_apply',
      {
        p_room: roomId,
        p_hash: this.guestHash(token),
        p_operation: operation,
      },
    );
    if (error) this.fail(error.message);
    return data as AnnotationCommit;
  }
  async context(
    token: string,
    sessionId: string,
    shareKey: string,
    includePresence = true,
  ): Promise<AnnotationContext> {
    const userId = await this.user(token);
    const { data, error } = await createSupabaseServiceClient().rpc(
      'screen_annotation_context',
      { p_session: sessionId, p_user: userId, p_share: shareKey },
    );
    if (error) this.fail(error.message);
    return includePresence
      ? this.withPresence(data as AnnotationContext)
      : (data as AnnotationContext);
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

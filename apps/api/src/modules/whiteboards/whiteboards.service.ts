import { continuousCanvas } from './continuous-canvas';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type {
  WhiteboardDocumentVM,
  WhiteboardRole,
  WhiteboardSnapshotVM,
} from '@iconicedu/shared-types';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { hashWhiteboardToken } from './whiteboard-access';
import {
  applyWhiteboardOperation,
  validateWhiteboardOperation,
} from './whiteboard-document';

@Injectable()
export class WhiteboardsService {
  private async access(token: string) {
    if (!/^[\w-]{43}$/.test(token))
      throw new ForbiddenException('Whiteboard access expired. Rejoin the class.');
    const db = createSupabaseServiceClient();
    const grant = await db
      .from('classroom_whiteboard_access')
      .select('board_id, role, live_session_id')
      .eq('token_hash', hashWhiteboardToken(token))
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (grant.error || !grant.data)
      throw new ForbiddenException('Whiteboard access expired. Rejoin the class.');
    const session = await db
      .from('channel_live_sessions')
      .select('id, status, app_metadata')
      .eq('id', grant.data.live_session_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (
      session.error ||
      !session.data ||
      !['starting', 'live'].includes(session.data.status)
    )
      throw new ForbiddenException('This class has ended');
    const meta = session.data.app_metadata as {
      meetingSettings?: { whiteboard?: { enabled?: boolean } };
    } | null;
    if (meta?.meetingSettings?.whiteboard?.enabled === false)
      throw new ForbiddenException('Whiteboard is disabled');
    return {
      db,
      boardId: grant.data.board_id as string,
      role: grant.data.role as WhiteboardRole,
    };
  }
  private async load(db: ReturnType<typeof createSupabaseServiceClient>, id: string) {
    const board = await db
      .from('classroom_whiteboards')
      .select('id, revision, document, applied_operations')
      .eq('id', id)
      .single();
    if (board.error) throw new InternalServerErrorException('Unable to load whiteboard');
    return board.data as {
      id: string;
      revision: number;
      document: WhiteboardDocumentVM;
      applied_operations: string[];
    };
  }
  async get(token: string): Promise<WhiteboardSnapshotVM>;
  async get(
    token: string,
    revision: number,
  ): Promise<WhiteboardSnapshotVM | Omit<WhiteboardSnapshotVM, 'document'>>;
  async get(
    token: string,
    revision?: number,
  ): Promise<WhiteboardSnapshotVM | Omit<WhiteboardSnapshotVM, 'document'>> {
    const { db, boardId, role } = await this.access(token);
    const heartbeat = await db
      .from('classroom_whiteboard_access')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('token_hash', hashWhiteboardToken(token));
    if (heartbeat.error)
      throw new InternalServerErrorException('Unable to connect to whiteboard');
    const board = await this.load(db, boardId);
    const presence = await db
      .from('classroom_whiteboard_access')
      .select('token_hash, display_name, role')
      .eq('board_id', boardId)
      .gt('last_seen_at', new Date(Date.now() - 15_000).toISOString())
      .gt('expires_at', new Date().toISOString());
    if (presence.error)
      throw new InternalServerErrorException('Unable to load whiteboard presence');
    return {
      id: board.id,
      revision: board.revision,
      ...(revision === board.revision
        ? {}
        : { document: continuousCanvas(board.document) }),
      role,
      presence: (presence.data ?? []).map((p) => ({
        id: p.token_hash.slice(0, 16),
        name: p.display_name,
        role: p.role as WhiteboardRole,
      })),
    };
  }
  async mutate(token: string, value: unknown): Promise<WhiteboardSnapshotVM> {
    const op = validateWhiteboardOperation(value);
    const { db, boardId, role } = await this.access(token);
    for (let attempt = 0; attempt < 5; attempt++) {
      const board = await this.load(db, boardId);
      // Check permissions even on replay: a lock cannot be bypassed with an old operation id.
      const document = applyWhiteboardOperation(board.document, op, role);
      if (board.applied_operations.includes(op.id)) return this.get(token);
      const saved = await db.rpc('commit_classroom_whiteboard', {
        p_board_id: boardId,
        p_revision: board.revision,
        p_document: document,
        p_operation_id: op.id,
      });
      if (saved.error)
        throw new InternalServerErrorException('Unable to save whiteboard');
      if (saved.data === true) return this.get(token);
    }
    throw new ConflictException('Whiteboard is busy. Your changes will retry.');
  }
}

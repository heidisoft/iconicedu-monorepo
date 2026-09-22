import { MessagePinsService } from './message-pins.service';
import { MessagesService } from '@iconicedu/api/modules/messages/messages.service';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { createSupabaseSessionClient } from '@iconicedu/api/lib/supabase/session';
import { ForbiddenException } from '@nestjs/common';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));
jest.mock('@iconicedu/api/lib/supabase/session', () => ({
  createSupabaseSessionClient: jest.fn(),
}));

function makeSessionClient(rpcResult: { data: unknown; error: null }) {
  return { rpc: jest.fn(async () => rpcResult) };
}

function makeChain<T>(result: { data: T; error: null; count?: number }) {
  const chain: Record<string, unknown> = {};
  ['select', 'eq', 'is', 'upsert', 'update'].forEach((method) => {
    chain[method] = jest.fn(() => chain);
  });
  (chain as { then: (...args: unknown[]) => Promise<unknown> }).then = (
    resolve,
    reject,
  ) => Promise.resolve(result).then(resolve as never, reject as never);
  return chain;
}

describe('MessagePinsService.togglePin', () => {
  const messagesService = {} as unknown as MessagesService;
  const service = new MessagePinsService(messagesService);

  beforeEach(() => {
    jest.mocked(createSupabaseServiceClient).mockReset();
    jest.mocked(createSupabaseSessionClient).mockReset();
  });

  it('rejects pinning when the actor cannot manage the channel', async () => {
    jest
      .mocked(createSupabaseSessionClient)
      .mockReturnValue(makeSessionClient({ data: false, error: null }) as never);

    await expect(
      service.togglePin('token', {
        orgId: 'org-1',
        channelId: 'chan-1',
        messageId: 'message-1',
        isPinned: true,
        profileId: 'profile-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects pinning once the channel is at the pin limit', async () => {
    jest
      .mocked(createSupabaseSessionClient)
      .mockReturnValue(makeSessionClient({ data: true, error: null }) as never);
    const countChain = makeChain({ data: null, error: null, count: 25 });
    const from = jest.fn((table: string) => {
      if (table === 'message_pins') return countChain;
      throw new Error(`unexpected table ${table}`);
    });
    jest.mocked(createSupabaseServiceClient).mockReturnValue({ from } as never);
    // Supabase's { count: 'exact', head: true } response carries `count`
    // alongside `data`/`error`; the mock chain's thenable resolves the whole
    // object, so `count` needs to be on the resolved value itself.
    (countChain as unknown as { then: (resolve: (v: unknown) => void) => void }).then = (
      resolve,
    ) => resolve({ data: null, error: null, count: 25 });

    await expect(
      service.togglePin('token', {
        orgId: 'org-1',
        channelId: 'chan-1',
        messageId: 'message-1',
        isPinned: true,
        profileId: 'profile-1',
      }),
    ).rejects.toThrow('already has the maximum of 25 pinned messages');
  });

  it('allows unpinning even when the channel is at the pin limit (no count check)', async () => {
    jest
      .mocked(createSupabaseSessionClient)
      .mockReturnValue(makeSessionClient({ data: true, error: null }) as never);
    const updateChain = makeChain({ data: null, error: null });
    const from = jest.fn((table: string) => {
      if (table === 'message_pins') return updateChain;
      throw new Error(`unexpected table ${table}`);
    });
    jest.mocked(createSupabaseServiceClient).mockReturnValue({ from } as never);

    await expect(
      service.togglePin('token', {
        orgId: 'org-1',
        channelId: 'chan-1',
        messageId: 'message-1',
        isPinned: false,
        profileId: 'profile-1',
      }),
    ).resolves.toEqual({ success: true });
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_by: 'profile-1' }),
    );
  });
});

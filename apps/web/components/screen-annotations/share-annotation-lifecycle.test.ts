import { expect, it, vi } from 'vitest';
import type { AnnotationContext, AnnotationCommit } from '@iconicedu/shared-types';
import { createShareAnnotationLifecycle } from './share-annotation-lifecycle';
const context: AnnotationContext = {
  actor: { userId: 'presenter', name: 'Presenter', role: 'educator' },
  actors: [],
  snapshot: {
    schemaVersion: 1,
    roomId: 'room',
    shareSessionId: 'room',
    revision: 0,
    studentsEnabled: true,
    ended: false,
    objects: [],
  },
};
it('closes only the stopped share and deduplicates SDK stop notifications', async () => {
  const apply = vi.fn().mockResolvedValue({} as AnnotationCommit);
  const lifecycle = createShareAnnotationLifecycle(apply);
  lifecycle.remember('123', context);
  lifecycle.remember('456', {
    ...context,
    snapshot: { ...context.snapshot, roomId: 'other' },
  });
  await Promise.all([lifecycle.end('123'), lifecycle.end('123')]);
  expect(apply).toHaveBeenCalledOnce();
  expect(apply).toHaveBeenCalledWith('room', expect.objectContaining({ kind: 'end' }));
  await lifecycle.end('123');
  expect(apply).toHaveBeenCalledOnce();
  await lifecycle.end('456');
  expect(apply).toHaveBeenLastCalledWith(
    'other',
    expect.objectContaining({ kind: 'end' }),
  );
});
it('does not close another participant’s share without presenter authority', async () => {
  const apply = vi.fn();
  const lifecycle = createShareAnnotationLifecycle(apply);
  lifecycle.remember('123', { ...context, actor: { ...context.actor, role: 'student' } });
  await lifecycle.end('123');
  expect(apply).not.toHaveBeenCalled();
});
it('preserves the new room when a previous share stop finishes late', async () => {
  let finish!: (value: AnnotationCommit) => void;
  const apply = vi.fn(
    () =>
      new Promise<AnnotationCommit>((resolve) => {
        finish = resolve;
      }),
  );
  const lifecycle = createShareAnnotationLifecycle(apply);
  lifecycle.remember('123', context);
  const request = lifecycle.end('123');
  await Promise.resolve();
  lifecycle.remember('123', {
    ...context,
    snapshot: { ...context.snapshot, roomId: 'new' },
  });
  finish({} as AnnotationCommit);
  await request;
  apply.mockResolvedValueOnce({} as AnnotationCommit);
  await lifecycle.end('123');
  expect(apply).toHaveBeenLastCalledWith('new', expect.objectContaining({ kind: 'end' }));
});

import { describe, it, expect } from 'vitest';
import { SceneHistory } from './scene-history';
import type { WhiteboardElementVM } from '@iconicedu/shared-types';
const element = (id: string, version = 1): WhiteboardElementVM => ({
  id,
  version,
  nonce: 1,
  deleted: false,
  data: { id, version, isDeleted: false },
});
describe('local scene history', () => {
  it('undoes local additions without removing remote work, then redoes with a new version', () => {
    const history = new SceneHistory();
    history.record([], [element('local')]);
    const undone = history.undo([element('local'), element('remote')]);
    expect(undone.find((e) => e.id === 'local')?.deleted).toBe(true);
    expect(undone.find((e) => e.id === 'remote')?.deleted).toBe(false);
    const redone = history.redo(undone);
    expect(redone.find((e) => e.id === 'local')?.deleted).toBe(false);
    expect(redone.find((e) => e.id === 'local')?.version).toBeGreaterThan(2);
  });
  it('restores modifications, clears redo on new work and resets across pages', () => {
    const h = new SceneHistory();
    h.record([element('a')], [{ ...element('a', 2), data: { x: 20 } }]);
    expect(h.undo([element('a', 2)])[0].data.isDeleted).toBe(false);
    h.record([], [element('b')]);
    expect(h.redo([element('b')])).toEqual([element('b')]);
    h.clear();
    expect(h.undo([element('b')])).toEqual([element('b')]);
  });
});

import type { WhiteboardElementVM } from '@iconicedu/shared-types';
type Change = {
  before: WhiteboardElementVM | undefined;
  after: WhiteboardElementVM | undefined;
  id: string;
};
export function changedElements(
  before: WhiteboardElementVM[],
  after: WhiteboardElementVM[],
) {
  const old = new Map(before.map((e) => [e.id, e]));
  return after.filter((e) => {
    const previous = old.get(e.id);
    return (
      !previous ||
      previous.version !== e.version ||
      previous.nonce !== e.nonce ||
      previous.deleted !== e.deleted
    );
  });
}
/** Local history records changed IDs only; undo never replaces unrelated remote work. */
export class SceneHistory {
  private past: Change[][] = [];
  private future: Change[][] = [];
  record(before: WhiteboardElementVM[], after: WhiteboardElementVM[]) {
    const old = new Map(before.map((e) => [e.id, e]));
    const change = changedElements(before, after).map((e) => ({
      id: e.id,
      before: old.get(e.id),
      after: e,
    }));
    if (change.length) {
      this.past.push(change);
      this.past = this.past.slice(-100);
      this.future = [];
    }
  }
  undo(current: WhiteboardElementVM[]) {
    const change = this.past.pop();
    if (!change) return current;
    this.future.push(change);
    return this.apply(current, change, 'before');
  }
  redo(current: WhiteboardElementVM[]) {
    const change = this.future.pop();
    if (!change) return current;
    this.past.push(change);
    return this.apply(current, change, 'after');
  }
  private apply(
    current: WhiteboardElementVM[],
    change: Change[],
    direction: 'before' | 'after',
  ) {
    const map = new Map(current.map((e) => [e.id, e]));
    for (const c of change) {
      const existing = map.get(c.id);
      const target = c[direction] ?? { ...c.after!, deleted: true };
      const version = Math.max(existing?.version ?? 0, target.version) + 1;
      const nonce = Math.floor(Math.random() * 0x7fffffff);
      map.set(c.id, {
        ...target,
        version,
        nonce,
        data: { ...target.data, version, versionNonce: nonce, isDeleted: target.deleted },
      });
    }
    return [...map.values()];
  }
  clear() {
    this.past = [];
    this.future = [];
  }
}

export const sceneFingerprint = (elements: WhiteboardElementVM[]) =>
  elements.map((e) => `${e.id}:${e.version}:${e.nonce}:${e.deleted}`).join('|');

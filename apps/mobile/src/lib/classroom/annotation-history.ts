import type {
  AnnotationCommit,
  AnnotationObject,
  AnnotationOperation,
  AnnotationSnapshot,
} from '@iconicedu/shared-types';
type Change = { before?: AnnotationObject; after?: AnnotationObject; version: number };
type Entry = { changes: Change[] };
export type HistoryDirection = 'undo' | 'redo';
export type AnnotationHistoryPlan = {
  direction: HistoryDirection;
  entry: Entry;
  operations: AnnotationOperation[];
};
const clone = (object: AnnotationObject) =>
  JSON.parse(JSON.stringify(object)) as AnnotationObject;

/** Local editing history. Provider versions prevent undo from overwriting another participant. */
export class NativeAnnotationHistory {
  private undo: Entry[] = [];
  private redo: Entry[] = [];
  get counts() {
    return { undo: this.undo.length, redo: this.redo.length };
  }
  record(
    before: AnnotationObject[],
    operation: AnnotationOperation,
    commit: AnnotationCommit,
  ) {
    if (!['put', 'delete', 'clear'].includes(operation.kind)) return;
    const changes = commit.objects.flatMap((after) => {
      const previous = before.find((object) => object.id === after.id);
      if ((!previous || previous.deleted) && after.deleted) return [];
      return [
        {
          before: previous && !previous.deleted ? clone(previous) : undefined,
          after: !after.deleted ? clone(after) : undefined,
          version: after.version,
        },
      ];
    });
    if (!changes.length) return;
    this.undo.push({ changes });
    if (this.undo.length > 100) this.undo.shift();
    this.redo = [];
  }
  prepare(
    direction: HistoryDirection,
    snapshot: AnnotationSnapshot,
  ): AnnotationHistoryPlan | null {
    const source = direction === 'undo' ? this.undo : this.redo;
    const entry = source.at(-1);
    if (!entry) return null;
    const operations = entry.changes.map((change) => {
      const id = (change.after ?? change.before)!.id;
      const current = snapshot.objects.find((object) => object.id === id);
      if (!current || current.version !== change.version) {
        source.pop();
        throw new Error(
          'This drawing changed on another device. Its history was skipped.',
        );
      }
      const target = direction === 'undo' ? change.before : change.after;
      return target
        ? {
            eventId: '',
            kind: 'put' as const,
            object: {
              ...clone(target),
              deleted: false,
              version: current.version + 1,
              updatedAt: Date.now(),
            },
            baseVersion: current.version,
          }
        : { eventId: '', kind: 'delete' as const, id, baseVersion: current.version };
    });
    return { direction, entry, operations };
  }
  complete(plan: AnnotationHistoryPlan, commits: AnnotationCommit[]) {
    const source = plan.direction === 'undo' ? this.undo : this.redo;
    const destination = plan.direction === 'undo' ? this.redo : this.undo;
    if (source.at(-1) !== plan.entry) return;
    source.pop();
    destination.push(plan.entry);
    const versions = new Map(
      commits.flatMap((commit) =>
        commit.objects.map((object) => [object.id, object.version] as const),
      ),
    );
    for (const entry of [...this.undo, ...this.redo]) {
      for (const change of entry.changes) {
        const version = versions.get((change.after ?? change.before)!.id);
        if (version !== undefined) change.version = version;
      }
    }
  }
}

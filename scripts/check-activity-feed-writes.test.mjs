import test from 'node:test';
import assert from 'node:assert/strict';

import { findUnauthorizedActivityFeedWritesInSources } from './check-activity-feed-writes.mjs';

test('allows projector upserts to activity_feed_items', () => {
  const violations = findUnauthorizedActivityFeedWritesInSources({
    'apps/web/lib/activity-feed/projector/project-activity-events.ts':
      "await supabase.from('activity_feed_items').upsert({ id: '1' });",
  });

  assert.equal(violations.length, 0);
});

test('rejects non-projector insert/upsert to activity_feed_items', () => {
  const violations = findUnauthorizedActivityFeedWritesInSources({
    'apps/web/app/actions/unsafe.ts':
      "await supabase.from('activity_feed_items').insert({ id: '1' });",
  });

  assert.equal(violations.length, 1);
  assert.equal(violations[0]?.code, 'activity_feed_items.insert_or_upsert');
});

test('rejects direct activity_events insert outside publisher', () => {
  const violations = findUnauthorizedActivityFeedWritesInSources({
    'apps/web/lib/admin/unsafe-emitter.ts':
      "await supabase.from('activity_events').insert({ id: '1' });",
  });

  assert.equal(violations.length, 1);
  assert.equal(violations[0]?.code, 'activity_events.insert');
});

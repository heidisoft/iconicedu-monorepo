import { describe, expectTypeOf, it } from 'vitest';

import type { ActivityVerbVM } from '@iconicedu/shared-types/vm/activity-feed';

describe('ActivityVerbVM', () => {
  it('accepts singular and plural activity verbs', () => {
    expectTypeOf<'member.invited'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'members.invited'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'class.created'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'classes.created'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'message.posted'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'messages.posted'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'summary.posted'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'summaries.posted'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'session.feedback_request.sent'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'sessions.feedback_request.sent'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'system.notice'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'systems.notice'>().toMatchTypeOf<ActivityVerbVM>();
  });
});

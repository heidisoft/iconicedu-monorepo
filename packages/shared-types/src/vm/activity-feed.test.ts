import { describe, expectTypeOf, it } from 'vitest';

import type {
  ActivityVerbSuppressionRuleVM,
  ActivityVerbVM,
} from '@iconicedu/shared-types/vm/activity-feed';

describe('ActivityVerbVM', () => {
  it('accepts singular and plural activity verbs', () => {
    expectTypeOf<'member.invited'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'members.invited'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'class.created'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'classes.created'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'dm.posted'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'dms.posted'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'dm.reaction.added'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'dms.reactions.added'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'dm.reaction.removed'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'dms.reactions.removed'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'message.posted'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'messages.posted'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'summary.posted'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'summaries.posted'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'session.feedback_request.sent'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'sessions.feedback_request.sent'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'system.notice'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'systems.notice'>().toMatchTypeOf<ActivityVerbVM>();
  });

  it('supports activity suppression rule types', () => {
    expectTypeOf<ActivityVerbSuppressionRuleVM>().toMatchTypeOf<{
      id: string;
      orgId: string;
      eventType: string;
      scope: 'org' | 'actor';
      isEnabled: boolean;
      createdAt: string;
      updatedAt: string;
    }>();
  });
});

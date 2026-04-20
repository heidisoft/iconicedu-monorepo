import { describe, expectTypeOf, it } from 'vitest';

import type {
  ActivityVerbSuppressionRuleVM,
  ActivityVerbVM,
} from '@iconicedu/shared-types/vm/activity-feed';

describe('ActivityVerbVM', () => {
  it('accepts singular and plural activity verbs', () => {
    expectTypeOf<'message.posted'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'messages.posted'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'class.session.rescheduled'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'class.sessions.canceled'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'session.feedback_request.sent'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'sessions.feedback_request.sent'>().toMatchTypeOf<ActivityVerbVM>();
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

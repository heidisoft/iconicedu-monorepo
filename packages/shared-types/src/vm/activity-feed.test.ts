import { describe, expectTypeOf, it } from 'vitest';

import type {
  ActivityVerbSuppressionRuleVM,
  ActivityVerbVM,
} from '@iconicedu/shared-types/vm/activity-feed';

describe('ActivityVerbVM', () => {
  it('accepts supported activity verbs', () => {
    expectTypeOf<'message.posted'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'message.mentioned'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'message.thread_reply.posted'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'file.uploaded'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'image.uploaded'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'audio.uploaded'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'reaction.added'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'class.session.rescheduled'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'class.session.canceled'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'session.reminder.sent'>().toMatchTypeOf<ActivityVerbVM>();
    expectTypeOf<'session.feedback_request.sent'>().toMatchTypeOf<ActivityVerbVM>();
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

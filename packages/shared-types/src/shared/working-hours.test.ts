import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  DAY_KEY_TO_WEEKDAY,
  WEEKDAY_TO_DAY_KEY,
  type WorkingHoursSchedule,
} from './working-hours';
import type { NotificationDefaultsVM } from '../vm/profile';

describe('@iconicedu/shared-types', () => {
  it('maps weekdays to day keys in both directions', () => {
    expect(WEEKDAY_TO_DAY_KEY.monday).toBe('Mon');
    expect(WEEKDAY_TO_DAY_KEY.sunday).toBe('Sun');
    expect(DAY_KEY_TO_WEEKDAY.Mon).toBe('monday');
    expect(DAY_KEY_TO_WEEKDAY.Sun).toBe('sunday');
  });

  it('keeps notification defaults constrained to the known keys type', () => {
    const defaults: NotificationDefaultsVM = {
      'messages.mentions': { channels: ['email'] },
      'schedule.upcoming_reminder': { channels: ['push', 'email'] },
    };

    expect(defaults['messages.mentions']?.channels).toEqual(['email']);
    expectTypeOf(defaults).toMatchTypeOf<NotificationDefaultsVM>();
  });

  it('preserves working hours schedule typing', () => {
    const schedule: WorkingHoursSchedule = [
      { day: 'monday', enabled: true, from: '09:00', to: '17:00' },
    ];

    expect(schedule).toHaveLength(1);
    expect(schedule[0]?.day).toBe('monday');
  });
});

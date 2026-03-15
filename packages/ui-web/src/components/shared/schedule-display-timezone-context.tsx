'use client';

import * as React from 'react';
import {
  resolveScheduleDisplayTimeZone,
  type ScheduleDisplayTimeZoneInput,
} from '@iconicedu/ui-web/lib/schedule-display-timezone';

const ScheduleDisplayTimeZoneContext = React.createContext<string | null>(null);

export function ScheduleDisplayTimeZoneProvider({
  children,
  timezone,
}: {
  children: React.ReactNode;
  timezone?: string | null;
}) {
  const resolvedTimezone = React.useMemo(
    () => resolveScheduleDisplayTimeZone(timezone),
    [timezone],
  );

  return (
    <ScheduleDisplayTimeZoneContext.Provider value={resolvedTimezone}>
      {children}
    </ScheduleDisplayTimeZoneContext.Provider>
  );
}

export function useScheduleDisplayTimeZone(timezone?: ScheduleDisplayTimeZoneInput) {
  const inheritedTimezone = React.useContext(ScheduleDisplayTimeZoneContext);

  return React.useMemo(
    () =>
      resolveScheduleDisplayTimeZone(
        timezone === undefined
          ? inheritedTimezone
          : typeof timezone === 'object' && timezone !== null
            ? {
                ...timezone,
                viewerTimezone: timezone.viewerTimezone ?? inheritedTimezone,
              }
            : timezone,
      ),
    [inheritedTimezone, timezone],
  );
}

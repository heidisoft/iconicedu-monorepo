'use client';

import * as React from 'react';
import { resolveScheduleDisplayTimeZone } from '@iconicedu/ui-web/lib/schedule-display-timezone';

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

export function useScheduleDisplayTimeZone(timezone?: string | null) {
  const inheritedTimezone = React.useContext(ScheduleDisplayTimeZoneContext);

  return React.useMemo(
    () => resolveScheduleDisplayTimeZone(timezone ?? inheritedTimezone),
    [inheritedTimezone, timezone],
  );
}

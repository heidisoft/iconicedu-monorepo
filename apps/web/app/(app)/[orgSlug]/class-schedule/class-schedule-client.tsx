"use client";

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClassScheduleContainer, DashboardHeader } from '@iconicedu/ui-web';
import type { ClassScheduleViewVM, ClassScheduleVM } from '@iconicedu/shared-types';

type ClassScheduleClientProps = {
  events: ClassScheduleVM[];
};

export function ClassScheduleClient({ events }: ClassScheduleClientProps) {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get('date');
  const viewParam = searchParams.get('view');

  const initialDate = useMemo(() => {
    if (!dateParam) return new Date();
    const [year, month, day] = dateParam.split('-').map(Number);
    if (!year || !month || !day) return new Date();
    return new Date(year, month - 1, day);
  }, [dateParam]);

  const initialView = useMemo<ClassScheduleViewVM>(() => {
    if (viewParam === 'week' || viewParam === 'day' || viewParam === 'month') {
      return viewParam;
    }
    return 'day';
  }, [viewParam]);

  const [currentDate, setCurrentDate] = useState(initialDate);
  const [view, setView] = useState<ClassScheduleViewVM>(initialView);

  useEffect(() => {
    setCurrentDate(initialDate);
  }, [initialDate]);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <DashboardHeader title="Calendar" />
      <ClassScheduleContainer
        currentDate={currentDate}
        view={view}
        onViewChange={setView}
        onDateSelect={setCurrentDate}
        events={events}
      />
    </div>
  );
}

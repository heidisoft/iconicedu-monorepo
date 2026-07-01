// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ClassScheduleHeader } from './class-schedule-header';

describe('ClassScheduleHeader', () => {
  it('renders icon-only schedule controls with accessible labels', () => {
    const onNavigate = vi.fn();
    const onViewChange = vi.fn();

    render(
      <ClassScheduleHeader
        currentDate={new Date(2026, 2, 21)}
        view="week"
        onNavigate={onNavigate}
        onViewChange={onViewChange}
        editFullScheduleHref="/iconic-academy/admin/classrooms"
      />,
    );

    expect(screen.getByRole('button', { name: 'Previous period' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next period' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit full schedule' })).toHaveAttribute(
      'href',
      '/iconic-academy/admin/classrooms',
    );
    expect(
      screen.getByRole('button', { name: 'Switch to day view' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    fireEvent.click(screen.getByRole('button', { name: 'Switch to day view' }));

    expect(onNavigate).toHaveBeenCalledWith('today');
    expect(onViewChange).toHaveBeenCalledWith('day');
  });

  it('hides the full schedule editor action when no href is provided', () => {
    render(
      <ClassScheduleHeader
        currentDate={new Date(2026, 2, 21)}
        view="day"
        onNavigate={vi.fn()}
        onViewChange={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('link', { name: 'Edit full schedule' }),
    ).not.toBeInTheDocument();
  });
});

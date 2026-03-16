import type { LiveSessionAttendanceListItemVM } from '@iconicedu/shared-types';

export function formatAttendanceDateTime(value: string | null | undefined) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatAttendanceDuration(seconds: number | null | undefined) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
    return '—';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

export function getAttendanceStatusTone(
  status: LiveSessionAttendanceListItemVM['status'],
) {
  switch (status) {
    case 'live':
      return 'default';
    case 'failed':
      return 'destructive';
    default:
      return 'secondary';
  }
}

export function formatAttendancePercent(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return `${Math.round(value * 100)}%`;
}

export function getParticipantAttendanceTone(
  status: 'expected' | 'attended' | 'partial' | 'full' | 'no_show' | 'excused',
) {
  switch (status) {
    case 'full':
      return 'default';
    case 'no_show':
      return 'destructive';
    case 'partial':
      return 'secondary';
    default:
      return 'outline';
  }
}

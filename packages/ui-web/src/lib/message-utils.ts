import {
  formatDate as formatDateInTimezone,
  formatDateTime as formatDateTimeInTimezone,
  formatTime as formatTimeInTimezone,
  getBrowserTimezone,
  resolveViewerTimezone,
} from '@iconicedu/utils';

const toDate = (value: Date | string): Date =>
  value instanceof Date ? value : new Date(value);

const getViewerTimezone = () => resolveViewerTimezone(null, getBrowserTimezone());

export const formatTime = (date: Date | string): string => {
  return formatTimeInViewerZone(date);
};

export const formatFullDate = (date: Date | string): string => {
  return (
    formatDateTimeInTimezone(
      toDate(date).toISOString(),
      getViewerTimezone(),
      'weekdayAndTimeWithZone',
    ) ?? ''
  );
};

export const formatThreadTime = (date: Date | string): string => {
  const dateValue = toDate(date);
  const now = new Date();
  const diff = now.getTime() - dateValue.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return formatTimeInViewerZone(dateValue);
};

export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatDateHeader = (date: Date | string): string => {
  const dateValue = toDate(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateValue.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (dateValue.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return (
      formatDateInTimezone(
        toDate(date).toISOString(),
        getViewerTimezone(),
        'weekdayLong',
      ) ?? ''
    );
  }
};

function formatTimeInViewerZone(date: Date | string) {
  return (
    formatTimeInTimezone(toDate(date).toISOString(), getViewerTimezone(), 'short') ?? ''
  );
}

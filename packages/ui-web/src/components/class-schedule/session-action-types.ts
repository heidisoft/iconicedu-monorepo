export type CancelSessionActionInput = {
  reason?: string | null;
};

export type EditSessionActionInput = {
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  reason?: string | null;
};

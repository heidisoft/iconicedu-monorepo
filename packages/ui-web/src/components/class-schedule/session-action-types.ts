export type CancelSessionActionInput = {
  reason?: string | null;
  sendActivityNotifications: boolean;
};

export type EditSessionActionInput = {
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  reason?: string | null;
  sendActivityNotifications: boolean;
};

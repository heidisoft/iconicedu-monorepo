'use client';

import { useId } from 'react';
import { Label } from '@iconicedu/ui-web/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web/ui/select';

type MediaDeviceOption = { deviceId: string; label?: string };

export function DeviceSelect({
  label,
  devices,
  selectedId,
  onChange,
  disabled = false,
}: {
  label: string;
  devices: MediaDeviceOption[];
  selectedId: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  if (!devices.length) return null;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Select
        value={selectedId ?? undefined}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={`Choose ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {devices.map((device) => (
            <SelectItem key={device.deviceId} value={device.deviceId}>
              {device.label || `${label} ${devices.indexOf(device) + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

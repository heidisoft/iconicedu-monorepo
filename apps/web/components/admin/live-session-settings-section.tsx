'use client';

import {
  Checkbox,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web';
import type {
  ChannelLiveSessionConfigVM,
  LiveSessionModeVM,
  LiveSessionProviderVM,
} from '@iconicedu/shared-types';

import { ADMIN_LIVE_SESSION_PROVIDER_OPTIONS } from '@iconicedu/web/lib/admin/live-session-config-options';
import {
  shouldShowLiveSessionJoinUrlField,
  withNextLiveSessionProvider,
} from '@iconicedu/web/components/admin/live-session-settings-section.utils';

const LIVE_SESSION_MODE_OPTIONS: LiveSessionModeVM[] = ['video', 'audio'];

type LiveSessionSettingsSectionProps = {
  legend?: string;
  description: string;
  providerSelectId: string;
  modeSelectId: string;
  joinUrlInputId: string;
  value: ChannelLiveSessionConfigVM;
  onChange: (next: ChannelLiveSessionConfigVM) => void;
};

export function LiveSessionSettingsSection({
  legend = 'Live sessions',
  description,
  providerSelectId,
  modeSelectId,
  joinUrlInputId,
  value,
  onChange,
}: LiveSessionSettingsSectionProps) {
  return (
    <FieldSet>
      <FieldLegend>{legend}</FieldLegend>
      <FieldDescription>{description}</FieldDescription>
      <FieldGroup>
        <div className="flex flex-wrap gap-4 pt-2">
          <Label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={value.enabled}
              onCheckedChange={(checked) =>
                onChange({
                  ...value,
                  enabled: checked === true,
                })
              }
            />
            Enable live sessions
          </Label>
        </div>
        <FieldGroup className="grid gap-3 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={providerSelectId}>Provider</FieldLabel>
            <Select
              value={value.provider}
              onValueChange={(nextValue) =>
                onChange(withNextLiveSessionProvider(value, nextValue as LiveSessionProviderVM))
              }
              disabled={!value.enabled}
            >
              <SelectTrigger id={providerSelectId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {ADMIN_LIVE_SESSION_PROVIDER_OPTIONS.map((provider) => (
                    <SelectItem key={provider.value} value={provider.value}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor={modeSelectId}>Mode</FieldLabel>
            <Select
              value={value.mode ?? 'video'}
              onValueChange={(nextValue) =>
                onChange({
                  ...value,
                  mode: nextValue as LiveSessionModeVM,
                })
              }
              disabled={!value.enabled}
            >
              <SelectTrigger id={modeSelectId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {LIVE_SESSION_MODE_OPTIONS.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {mode}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
        {shouldShowLiveSessionJoinUrlField(value) && (
          <Field>
            <FieldLabel htmlFor={joinUrlInputId}>Join URL</FieldLabel>
            <Input
              id={joinUrlInputId}
              type="url"
              placeholder="https://meet.example.com/room"
              value={value.joinUrl ?? ''}
              onChange={(event) =>
                onChange({
                  ...value,
                  joinUrl: event.target.value,
                })
              }
            />
            <FieldDescription>
              Used when the external provider is selected. Channel join actions will open this URL directly.
            </FieldDescription>
          </Field>
        )}
      </FieldGroup>
    </FieldSet>
  );
}

'use client';
import { Checkbox, FieldDescription, Label } from '@iconicedu/ui-web';
import type { LiveSessionSettingsVM } from '@iconicedu/shared-types';

type Section = keyof LiveSessionSettingsVM;
const OPTIONS: Array<{
  section: Section;
  key: string;
  label: string;
  description: string;
}> = [
  {
    section: 'recording',
    key: 'enabled',
    label: 'Recording',
    description: 'Allow the host to use Zoom cloud recording.',
  },
  {
    section: 'recording',
    key: 'autoStart',
    label: 'Start Recording',
    description: 'Start automatically when the host joins.',
  },
  {
    section: 'recording',
    key: 'allowStop',
    label: 'Disable Stop Recording',
    description: 'Lock the in-app stop control while recording is active.',
  },
  {
    section: 'whiteboard',
    key: 'enabled',
    label: 'Whiteboard',
    description: 'Show whiteboard controls during the meeting.',
  },
  {
    section: 'invite',
    key: 'enabled',
    label: 'Shared Invite',
    description:
      'Allow joining with a shared link and passcode. When off, only Classroom members can join.',
  },
  {
    section: 'participants',
    key: 'visible',
    label: 'Show Participants',
    description: 'Show the participant list and its controls.',
  },
  {
    section: 'messages',
    key: 'visible',
    label: 'Messages',
    description: 'Show the in-call message panel.',
  },
  {
    section: 'messages',
    key: 'enabled',
    label: 'Enable Messages',
    description: 'Allow participants to send in-call messages.',
  },
];

export function MeetingFeatureSettings({
  value,
  onChange,
  disabled = false,
  whiteboardProviderAvailable = false,
}: {
  value: LiveSessionSettingsVM;
  onChange: (settings: LiveSessionSettingsVM) => void;
  disabled?: boolean;
  whiteboardProviderAvailable?: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-label="Meeting features">
      {whiteboardProviderAvailable && (
        <label className="text-sm font-medium">
          Whiteboard provider
          <select
            aria-label="Whiteboard provider"
            className="mt-1 block min-h-11 w-full rounded border border-border bg-background px-3"
            disabled={disabled || !value.whiteboard.enabled}
            value={value.whiteboard.provider ?? 'excalidraw'}
            onChange={(event) =>
              onChange({
                ...value,
                whiteboard: {
                  ...value.whiteboard,
                  provider: event.target.value as 'excalidraw' | 'zoom',
                },
              })
            }
          >
            <option value="excalidraw">Class whiteboard (Excalidraw)</option>
            <option value="zoom">Zoom Whiteboard</option>
          </select>
        </label>
      )}
      {OPTIONS.map((option) => {
        const inverted = option.section === 'recording' && option.key === 'allowStop';
        const checked = (value[option.section] as unknown as Record<string, boolean>)[
          option.key
        ];
        const unavailable =
          disabled ||
          (option.section === 'recording' &&
            option.key !== 'enabled' &&
            !value.recording.enabled) ||
          (option.section === 'messages' &&
            option.key === 'enabled' &&
            !value.messages.visible);
        return (
          <div key={`${option.section}.${option.key}`}>
            <Label className="flex items-center gap-2">
              <Checkbox
                checked={inverted ? !checked : checked}
                disabled={unavailable}
                onCheckedChange={(next) => {
                  const updated = {
                    ...value,
                    [option.section]: {
                      ...value[option.section],
                      [option.key]: inverted ? next !== true : next === true,
                    },
                  };
                  if (!updated.recording.enabled)
                    updated.recording = {
                      enabled: false,
                      autoStart: false,
                      allowStop: true,
                    };
                  if (!updated.messages.visible)
                    updated.messages = { visible: false, enabled: false };
                  onChange(updated);
                }}
              />
              {option.label}
            </Label>
            <FieldDescription className="mt-1">{option.description}</FieldDescription>
          </div>
        );
      })}
    </div>
  );
}

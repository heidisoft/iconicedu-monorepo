'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Button,
  Loader2,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldSeparator,
  Input,
  Label,
  Checkbox,
  Textarea,
  ParticipantSelector,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  ChannelUiDefaultsSettingsSection,
} from '@iconicedu/ui-web';

import type {
  ChannelCapabilityVM,
  ChannelKind,
  ChannelLiveSessionConfigVM,
  ChannelTopicIconKey,
  ChannelPurpose,
  ChannelStatus,
  ChannelVisibility,
  ChannelCreatePayload,
  ChannelPostingPolicyVM,
  ChannelUiDefaultsVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import { CHANNEL_TOPIC_ICON_GROUPS } from '@iconicedu/shared-types';
import { CHANNEL_TOPIC_ICON_MAP } from '@iconicedu/ui-web/lib/icons';
import { LiveSessionSettingsSection } from '@iconicedu/web/components/admin/live-session-settings-section';
import type { ChannelDetail } from '@iconicedu/web/lib/admin/channel-detail';
import { withInfoPanelDisabled } from '@iconicedu/web/lib/channels/ui-defaults';
import { DEFAULT_ADMIN_LIVE_SESSION_CONFIG } from '@iconicedu/web/lib/admin/live-session-config';

const NO_CHANNEL_ICON_VALUE = '__none__';

type ChannelFormState = {
  topic: string;
  iconKey: ChannelTopicIconKey | typeof NO_CHANNEL_ICON_VALUE;
  description: string;
  kind: string;
  purpose: string;
  visibility: string;
  uiDefaults: ChannelUiDefaultsVM;
  status: ChannelStatus;
  liveSession: ChannelLiveSessionConfigVM;
  postingPolicyKind: ChannelPostingPolicyVM['kind'];
  allowThreads: boolean;
  allowReactions: boolean;
  participants: UserProfileVM[];
  capabilities: ChannelCapabilityVM[];
};

function createDefaultChannelUiDefaults(): ChannelUiDefaultsVM {
  return withInfoPanelDisabled({
    themeKey: 'teal',
    defaultRightPanelKey: 'channel_info',
  });
}

function detailToFormState(detail: ChannelDetail): ChannelFormState {
  return {
    topic: detail.basics.topic ?? '',
    iconKey: detail.basics.iconKey ?? NO_CHANNEL_ICON_VALUE,
    description: detail.basics.description ?? '',
    kind: detail.basics.kind,
    purpose: detail.basics.purpose,
    visibility: detail.basics.visibility,
    uiDefaults: {
      ...createDefaultChannelUiDefaults(),
      ...(detail.ui ?? {}),
      themeKey: detail.ui?.themeKey ?? 'teal',
    },
    status: detail.lifecycle.status,
    liveSession: detail.liveSession ?? { ...DEFAULT_ADMIN_LIVE_SESSION_CONFIG },
    postingPolicyKind: detail.postingPolicy.kind,
    allowThreads: detail.postingPolicy.allowThreads ?? true,
    allowReactions: detail.postingPolicy.allowReactions ?? true,
    participants: detail.participants ?? [],
    capabilities: detail.capabilities ?? [],
  };
}

function defaultFormState(): ChannelFormState {
  return {
    topic: '',
    iconKey: NO_CHANNEL_ICON_VALUE,
    description: '',
    kind: 'channel',
    purpose: 'general',
    visibility: 'private',
    uiDefaults: createDefaultChannelUiDefaults(),
    status: 'active',
    liveSession: { ...DEFAULT_ADMIN_LIVE_SESSION_CONFIG },
    postingPolicyKind: 'members-only',
    allowThreads: true,
    allowReactions: true,
    participants: [],
    capabilities: [],
  };
}

type ChannelFormProps = {
  orgSlug: string;
  mode: 'create' | 'edit';
  initialData?: ChannelDetail;
  channelId?: string;
};

export function ChannelForm({ orgSlug, mode, initialData, channelId }: ChannelFormProps) {
  const router = useRouter();
  const backUrl = `/${orgSlug}/admin/channels`;

  const [formState, setFormState] = React.useState<ChannelFormState>(() =>
    initialData ? detailToFormState(initialData) : defaultFormState(),
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [participantOptions, setParticipantOptions] = React.useState<UserProfileVM[]>([]);

  React.useEffect(() => {
    void fetch('/api/admin/channels/participants')
      .then((res) => res.json())
      .then((payload: { data?: UserProfileVM[] }) =>
        setParticipantOptions(payload.data ?? []),
      )
      .catch(() => setParticipantOptions([]));
  }, []);

  const updateFormState = (patch: Partial<ChannelFormState>) => {
    setFormState((prev) => ({ ...prev, ...patch }));
  };

  const handleSubmit = async () => {
    setIsSubmitted(true);
    if (!formState.topic.trim()) {
      setSubmitError('Channel name is required.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const createPayload: ChannelCreatePayload = {
        basics: {
          kind: formState.kind as ChannelKind,
          topic: formState.topic.trim(),
          iconKey: formState.iconKey === NO_CHANNEL_ICON_VALUE ? null : formState.iconKey,
          description: formState.description.trim() || null,
          visibility: formState.visibility as ChannelVisibility,
          purpose: formState.purpose as ChannelPurpose,
        },
        ui: { ...formState.uiDefaults, themeKey: formState.uiDefaults.themeKey ?? null },
        liveSession: formState.liveSession.enabled ? formState.liveSession : null,
        postingPolicy: {
          kind: formState.postingPolicyKind,
          allowThreads: formState.allowThreads,
          allowReactions: formState.allowReactions,
        },
        lifecycle: { status: formState.status },
        participants: formState.participants.map((p) => ({
          profileId: p.ids.id,
          roleInChannel: null,
        })),
        capabilities: formState.capabilities,
      };

      const endpoint =
        mode === 'edit' ? '/api/admin/channels/update' : '/api/admin/channels/create';
      const body =
        mode === 'edit'
          ? JSON.stringify({ channelId, payload: createPayload })
          : JSON.stringify(createPayload);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const responsePayload = (await response.json()) as {
        success?: boolean;
        message?: string;
      };
      if (!response.ok || !responsePayload.success) {
        setSubmitError(responsePayload.message ?? 'Unable to save channel.');
        return;
      }
      router.push(backUrl);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save channel.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 max-w-2xl">
      <FieldSet data-invalid={isSubmitted && !formState.topic.trim()}>
        <FieldLegend>Basics</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="channel-topic">
              Name <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="channel-topic"
              value={formState.topic}
              onChange={(e) => updateFormState({ topic: e.target.value })}
              placeholder="e.g., General updates"
              required
              aria-required="true"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="channel-kind">Kind</FieldLabel>
            <Select
              value={formState.kind}
              onValueChange={(value) => updateFormState({ kind: value })}
              disabled={mode === 'edit'}
            >
              <SelectTrigger id="channel-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="channel">Channel</SelectItem>
                <SelectItem value="group_dm">Group DM</SelectItem>
                <SelectItem value="dm">DM</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="channel-purpose">Purpose</FieldLabel>
            <Select
              value={formState.purpose}
              onValueChange={(value) => updateFormState({ purpose: value })}
              disabled={mode === 'edit'}
            >
              <SelectTrigger id="channel-purpose">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="learning-space">Class</SelectItem>
                <SelectItem value="chass-requests">Class requests</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="announcements">Announcements</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="channel-visibility">Visibility</FieldLabel>
            <Select
              value={formState.visibility}
              onValueChange={(value) => updateFormState({ visibility: value })}
            >
              <SelectTrigger id="channel-visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="public">Public</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="channel-icon">Icon</FieldLabel>
            <Select
              value={formState.iconKey}
              onValueChange={(value) =>
                updateFormState({
                  iconKey: value as ChannelTopicIconKey | typeof NO_CHANNEL_ICON_VALUE,
                })
              }
            >
              <SelectTrigger id="channel-icon">
                <SelectValue placeholder="No icon" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CHANNEL_ICON_VALUE}>No icon</SelectItem>
                {CHANNEL_TOPIC_ICON_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.options.map((option) => {
                      const Icon = CHANNEL_TOPIC_ICON_MAP[option.value];
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="size-4" aria-hidden />
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              Optional. Useful for support, public, private, parent, or other group
              channels.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="channel-description">Description</FieldLabel>
            <Textarea
              id="channel-description"
              value={formState.description}
              onChange={(e) => updateFormState({ description: e.target.value })}
              placeholder="Optional description"
              rows={3}
            />
          </Field>
        </FieldGroup>
      </FieldSet>

      <FieldSeparator />

      <FieldSet>
        <FieldLegend>Posting policy</FieldLegend>
        <FieldDescription>
          Control who can post and whether threads or reactions are enabled.
        </FieldDescription>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="channel-posting-policy">Policy</FieldLabel>
            <Select
              value={formState.postingPolicyKind}
              onValueChange={(value) =>
                updateFormState({
                  postingPolicyKind: value as ChannelPostingPolicyVM['kind'],
                })
              }
            >
              <SelectTrigger id="channel-posting-policy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="everyone">Everyone</SelectItem>
                <SelectItem value="members-only">Members only</SelectItem>
                <SelectItem value="staff-only">Staff only</SelectItem>
                <SelectItem value="read-only">Read only</SelectItem>
                <SelectItem value="owners_only">Owners only</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="flex flex-wrap gap-4 pt-2">
            <Label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={formState.allowThreads}
                onCheckedChange={(checked) =>
                  updateFormState({ allowThreads: checked === true })
                }
              />
              Allow threads
            </Label>
            <Label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={formState.allowReactions}
                onCheckedChange={(checked) =>
                  updateFormState({ allowReactions: checked === true })
                }
              />
              Allow reactions
            </Label>
          </div>
        </FieldGroup>
      </FieldSet>

      <FieldSeparator />

      <LiveSessionSettingsSection
        description="Configure how members can start and join live sessions from the channel header."
        providerSelectId="channel-live-session-provider"
        modeSelectId="channel-live-session-mode"
        joinUrlInputId="channel-live-session-join-url"
        value={formState.liveSession}
        onChange={(nextLiveSession) => updateFormState({ liveSession: nextLiveSession })}
      />

      <FieldSet>
        <FieldLegend>Participants</FieldLegend>
        <FieldDescription>
          Select the participants who should be members of this channel.
        </FieldDescription>
        <FieldGroup>
          <ParticipantSelector
            users={participantOptions}
            selectedUsers={formState.participants}
            onUserAdd={(user) =>
              updateFormState({
                participants: formState.participants.some((p) => p.ids.id === user.ids.id)
                  ? formState.participants
                  : [...formState.participants, user],
              })
            }
            onUserRemove={(user) =>
              updateFormState({
                participants: formState.participants.filter(
                  (p) => p.ids.id !== user.ids.id,
                ),
              })
            }
            placeholder="Add participant"
          />
        </FieldGroup>
      </FieldSet>

      <FieldSeparator />

      <FieldSet>
        <FieldLegend>Capabilities</FieldLegend>
        <FieldDescription>Enable optional features for this channel.</FieldDescription>
        <FieldGroup>
          <div className="flex flex-col gap-2">
            {(
              ['has_schedule', 'has_homework', 'has_summaries'] as ChannelCapabilityVM[]
            ).map((capability) => (
              <Label key={capability} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={formState.capabilities.includes(capability)}
                  onCheckedChange={(checked) =>
                    updateFormState({
                      capabilities:
                        checked === true
                          ? formState.capabilities.includes(capability)
                            ? formState.capabilities
                            : [...formState.capabilities, capability]
                          : formState.capabilities.filter((c) => c !== capability),
                    })
                  }
                />
                {capability.replace('has_', '').replace('_', ' ')}
              </Label>
            ))}
          </div>
        </FieldGroup>
      </FieldSet>

      <FieldSeparator />

      <ChannelUiDefaultsSettingsSection
        themeSelectId="channel-theme-key"
        uiDefaults={formState.uiDefaults}
        onUiDefaultsChange={(updates) =>
          updateFormState({
            uiDefaults: {
              ...formState.uiDefaults,
              ...updates,
              infoPanel: {
                ...(formState.uiDefaults.infoPanel ?? {}),
                ...(updates.infoPanel ?? {}),
              },
            },
          })
        }
      />

      {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              {mode === 'edit' ? 'Saving…' : 'Creating…'}
            </>
          ) : mode === 'edit' ? (
            'Save changes'
          ) : (
            'Create channel'
          )}
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.push(backUrl)}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

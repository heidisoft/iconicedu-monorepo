'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Button,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldSeparator,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  ChannelUiDefaultsSettingsSection,
  toast,
  ParticipantSelector,
  RecurrenceScheduler,
} from '@iconicedu/ui-web';
import { Textarea } from '@iconicedu/ui-web/ui/textarea';
import {
  DEFAULT_LEARNING_SPACE_ICON_KEY,
  LEARNING_SPACE_ICON_MAP,
  LEARNING_SPACE_ICON_OPTIONS,
  type LearningSpaceIconKey,
} from '@iconicedu/ui-web/lib/icons';
import type { RecurrenceFormData } from '@iconicedu/ui-web/lib/recurrence-types';
import type {
  ChannelLiveSessionConfigVM,
  ChannelUiDefaultsVM,
  LearningSpaceCreatePayload,
  ThemeKey,
  UserProfileVM,
} from '@iconicedu/shared-types';
import { STANDARD_SUBJECT_OPTIONS } from '@iconicedu/shared-types';
import {
  buildSchedulesHashKeyFromFormSchedules,
  mapSchedulesToPayload,
  normalizeSchedules,
} from '@iconicedu/web/app/(app)/[orgSlug]/admin/classrooms/learning-space-form-dialog.utils';
import { LiveSessionSettingsSection } from '@iconicedu/web/components/admin/live-session-settings-section';
import { DEFAULT_ADMIN_LIVE_SESSION_CONFIG } from '@iconicedu/web/lib/admin/live-session-config';
import { mergeSubjectOptions } from '@iconicedu/web/lib/subjects/utils';
import type { LearningSpaceDetail } from '@iconicedu/web/lib/admin/learning-space-detail';

const KIND_OPTIONS = [
  { value: 'one_on_one', label: 'One on one' },
  { value: 'small_group', label: 'Small group' },
  { value: 'large_class', label: 'Large class' },
];

const mapParticipantsToPayload = (selected: UserProfileVM[]) =>
  selected.map((participant) => ({
    profileId: participant.ids.id,
    kind: participant.kind,
    displayName: participant.profile.displayName,
    avatarUrl: participant.profile.avatar.url ?? null,
    themeKey: participant.ui?.themeKey ?? null,
  }));

function createDefaultUiDefaults(): ChannelUiDefaultsVM {
  return {
    themeKey: 'teal',
    defaultRightPanelOpen: false,
    defaultRightPanelKey: 'channel_info',
    infoPanel: {
      showHeader: false,
      showDetails: false,
      showMedia: false,
      showMembers: false,
      showQuickActions: false,
      showHiddenQuickActions: false,
    },
  };
}

type FormState = {
  kind: string;
  title: string;
  subject: string;
  description: string;
  iconKey: LearningSpaceIconKey;
  uiDefaults: ChannelUiDefaultsVM;
  participants: UserProfileVM[];
  schedules: RecurrenceFormData[];
  liveSession: ChannelLiveSessionConfigVM;
};

type LearningSpaceFormProps = {
  orgSlug: string;
  participantOptions?: UserProfileVM[];
  subjectOptions?: string[];
  defaultScheduleTimezone?: string | null;
  mode?: 'create' | 'edit';
  initialData?: LearningSpaceDetail | null;
};

export function LearningSpaceForm({
  orgSlug,
  participantOptions = [],
  subjectOptions = [...STANDARD_SUBJECT_OPTIONS],
  defaultScheduleTimezone,
  mode = 'create',
  initialData,
}: LearningSpaceFormProps) {
  const router = useRouter();
  const backUrl = `/${orgSlug}/admin/classrooms`;

  const initialState = React.useMemo<FormState>(
    () => ({
      kind: KIND_OPTIONS[0].value,
      title: '',
      subject: '',
      description: '',
      iconKey: DEFAULT_LEARNING_SPACE_ICON_KEY,
      uiDefaults: createDefaultUiDefaults(),
      participants: [],
      schedules: [],
      liveSession: { ...DEFAULT_ADMIN_LIVE_SESSION_CONFIG },
    }),
    [],
  );

  const [formState, setFormState] = React.useState<FormState>(() => {
    if (mode === 'edit' && initialData) {
      return {
        kind: initialData.basics.kind,
        title: initialData.basics.title,
        subject: initialData.basics.subject ?? '',
        description: initialData.basics.description ?? '',
        iconKey: (initialData.basics.iconKey ??
          DEFAULT_LEARNING_SPACE_ICON_KEY) as LearningSpaceIconKey,
        uiDefaults: {
          ...createDefaultUiDefaults(),
          ...(initialData.settings?.uiDefaults ?? {}),
          themeKey: (initialData.settings?.themeKey ?? 'teal') as ThemeKey,
        },
        participants: initialData.participants ?? [],
        schedules: normalizeSchedules(initialData.schedules ?? []),
        liveSession: initialData.liveSession ?? { ...DEFAULT_ADMIN_LIVE_SESSION_CONFIG },
      };
    }
    return initialState;
  });

  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const initialScheduleHashKey = React.useMemo(
    () => buildSchedulesHashKeyFromFormSchedules(initialData?.schedules ?? []),
    [initialData?.schedules],
  );
  const currentScheduleHashKey = React.useMemo(
    () => buildSchedulesHashKeyFromFormSchedules(formState.schedules),
    [formState.schedules],
  );

  const subjectSelectOptions = React.useMemo(
    () =>
      mergeSubjectOptions(subjectOptions, [
        initialData?.basics.subject,
        formState.subject,
      ]),
    [formState.subject, initialData?.basics.subject, subjectOptions],
  );

  const iconInvalid = isSubmitted && !formState.iconKey;
  const titleInvalid = isSubmitted && !formState.title.trim();
  const kindInvalid = isSubmitted && !formState.kind;
  const participantsInvalid = isSubmitted && formState.participants.length === 0;

  const update = (updates: Partial<FormState>) =>
    setFormState((prev) => ({ ...prev, ...updates }));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitted(true);

    if (
      !formState.iconKey ||
      !formState.title.trim() ||
      !formState.kind ||
      formState.participants.length === 0
    ) {
      toast.error('Please fill in all required fields.');
      return;
    }

    const payload: LearningSpaceCreatePayload = {
      basics: {
        title: formState.title.trim(),
        kind: formState.kind,
        iconKey: formState.iconKey,
        subject: formState.subject || null,
        description: formState.description.trim() || null,
      },
      settings: {
        themeKey: formState.uiDefaults.themeKey ?? null,
        uiDefaults: formState.uiDefaults,
      },
      participants: mapParticipantsToPayload(formState.participants),
      liveSession: formState.liveSession.enabled ? formState.liveSession : null,
      schedules: mapSchedulesToPayload(formState.schedules),
    };

    setIsSaving(true);
    try {
      const endpoint =
        mode === 'edit' ? '/api/admin/spaces/update' : '/api/admin/spaces/create';
      const body =
        mode === 'edit'
          ? JSON.stringify({
              learningSpaceId: initialData?.ids.id,
              payload,
              initialScheduleHashKey,
              scheduleHashKey: currentScheduleHashKey,
              hasScheduleChanges: initialScheduleHashKey !== currentScheduleHashKey,
            })
          : JSON.stringify(payload);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const result = (await response.json()) as {
        success?: boolean;
        message?: string;
        data?: { learningSpaceId?: string };
      };
      if (!response.ok || !result.success) {
        toast.error(
          result.message ??
            (mode === 'edit'
              ? 'Unable to update classroom.'
              : 'Unable to create classroom.'),
        );
        return;
      }
      toast.success(mode === 'edit' ? 'Classroom updated.' : 'Classroom created.');
      router.push(backUrl);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : mode === 'edit'
            ? 'Unable to update classroom.'
            : 'Unable to create classroom.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      id="learning-space-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 max-w-2xl"
    >
      <FieldSet>
        <FieldLegend>Basics</FieldLegend>
        <FieldGroup className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)]">
          <Field data-invalid={iconInvalid} className="items-center gap-2">
            <FieldLabel htmlFor="ls-icon">
              Icon <span className="text-destructive">*</span>
            </FieldLabel>
            <Select
              value={formState.iconKey}
              onValueChange={(value) =>
                update({ iconKey: value as LearningSpaceIconKey })
              }
            >
              <SelectTrigger
                aria-label="Select icon"
                className="flex size-9 items-center justify-center rounded-full border border-border bg-muted"
              >
                <SelectValue placeholder="Select icon" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {LEARNING_SPACE_ICON_OPTIONS.map((option) => {
                    const Icon = LEARNING_SPACE_ICON_MAP[option.value];
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
              </SelectContent>
            </Select>
            {iconInvalid && (
              <FieldDescription className="text-destructive">
                Please choose an icon.
              </FieldDescription>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="ls-title">
              Title <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="ls-title"
              value={formState.title}
              onChange={(e) => update({ title: e.target.value })}
              required
              aria-invalid={titleInvalid}
            />
            {titleInvalid && (
              <FieldDescription className="text-destructive">
                Title is required.
              </FieldDescription>
            )}
          </Field>
        </FieldGroup>
        <FieldGroup className="grid gap-3 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="ls-subject">Subject</FieldLabel>
            <Select
              value={formState.subject}
              onValueChange={(value) => update({ subject: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Subjects</SelectLabel>
                  {subjectSelectOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field data-invalid={kindInvalid}>
            <FieldLabel htmlFor="ls-kind">
              Kind <span className="text-destructive">*</span>
            </FieldLabel>
            <Select
              value={formState.kind}
              onValueChange={(value) => update({ kind: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Learning kinds</SelectLabel>
                  {KIND_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {kindInvalid && (
              <FieldDescription className="text-destructive">
                Kind is required.
              </FieldDescription>
            )}
          </Field>
        </FieldGroup>
        <Field>
          <FieldLabel htmlFor="ls-description">Description</FieldLabel>
          <Textarea
            id="ls-description"
            value={formState.description}
            onChange={(e) => update({ description: e.target.value })}
            rows={3}
          />
        </Field>
      </FieldSet>

      <FieldSeparator />

      <LiveSessionSettingsSection
        description="Configure the primary channel's live session provider and mode for this classroom."
        providerSelectId="ls-live-session-provider"
        modeSelectId="ls-live-session-mode"
        joinUrlInputId="ls-live-session-join-url"
        value={formState.liveSession}
        onChange={(nextLiveSession) => update({ liveSession: nextLiveSession })}
      />

      <FieldSeparator />

      <FieldSet data-invalid={participantsInvalid}>
        <FieldLegend>
          Participants <span className="text-destructive">*</span>
        </FieldLegend>
        <FieldDescription>
          Select families and educators with grouped chips for quick selection.
        </FieldDescription>
        <FieldGroup>
          <ParticipantSelector
            users={participantOptions}
            selectedUsers={formState.participants}
            onUserAdd={(user) =>
              update({
                participants: formState.participants.some((p) => p.ids.id === user.ids.id)
                  ? formState.participants
                  : [...formState.participants, user],
              })
            }
            onUserRemove={(user) =>
              update({
                participants: formState.participants.filter(
                  (p) => p.ids.id !== user.ids.id,
                ),
              })
            }
            placeholder="Add participant"
          />
        </FieldGroup>
        {participantsInvalid && (
          <FieldDescription className="text-destructive">
            At least one participant is required.
          </FieldDescription>
        )}
      </FieldSet>

      <FieldSeparator />

      <FieldSet>
        <FieldLegend>Schedule</FieldLegend>
        <RecurrenceScheduler
          className="max-w-none"
          defaultTimezone={defaultScheduleTimezone}
          schedules={formState.schedules}
          onSchedulesChange={(nextSchedules) => update({ schedules: nextSchedules })}
        />
      </FieldSet>

      <ChannelUiDefaultsSettingsSection
        legend="Settings"
        themeSelectId="ls-theme-key"
        description="Sets the accent color used across this classroom message UI."
        uiDefaults={formState.uiDefaults}
        onUiDefaultsChange={(updates) =>
          update({
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

      <div className="flex items-center gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(backUrl)}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving
            ? mode === 'edit'
              ? 'Saving...'
              : 'Creating...'
            : mode === 'edit'
              ? 'Save changes'
              : 'Create classroom'}
        </Button>
      </div>
    </form>
  );
}

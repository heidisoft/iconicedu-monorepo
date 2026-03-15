'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  ScrollArea,
  ScrollBar,
  Plus,
  ChannelUiDefaultsSettingsSection,
  toast,
  ResourceLinksEditor,
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
  LearningSpaceLinkVM,
  ThemeKey,
  UserProfileVM,
} from '@iconicedu/shared-types';
import {
  buildSchedulesHashKeyFromFormSchedules,
  mapSchedulesToPayload,
  normalizeSchedules,
} from '@iconicedu/web/app/(app)/[orgSlug]/admin/spaces/learning-space-form-dialog.utils';
import { LiveSessionSettingsSection } from '@iconicedu/web/components/admin/live-session-settings-section';
import { DEFAULT_ADMIN_LIVE_SESSION_CONFIG } from '@iconicedu/web/lib/admin/live-session-config';

const KIND_OPTIONS = [
  { value: 'one_on_one', label: 'One on one' },
  { value: 'small_group', label: 'Small group' },
  { value: 'large_class', label: 'Large class' },
];

const SUBJECT_OPTIONS = ['MATH', 'SCIENCE', 'ELA', 'CHESS'];
const mapLinksToPayload = (links: LearningSpaceLinkVM[]) =>
  links.map((resource) => ({
    label: resource.label,
    iconKey: resource.iconKey ?? null,
    url: resource.url ?? null,
    status: resource.status ?? null,
    hidden: resource.hidden ?? null,
  }));

const mapParticipantsToPayload = (selected: UserProfileVM[]) =>
  selected.map((participant) => ({
    profileId: participant.ids.id,
    kind: participant.kind,
    displayName: participant.profile.displayName,
    avatarUrl: participant.profile.avatar.url ?? null,
    themeKey: participant.ui?.themeKey ?? null,
  }));

type LearningSpaceFormDialogProps = {
  participantOptions?: UserProfileVM[];
  defaultScheduleTimezone?: string | null;
  mode?: 'create' | 'edit';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialData?: {
    ids: { id: string };
    basics: {
      kind: string;
      title: string;
      iconKey: string | null;
      subject?: string | null;
      description?: string | null;
    };
    settings?: {
      themeKey?: ThemeKey | null;
      uiDefaults?: ChannelUiDefaultsVM | null;
    } | null;
    participants: UserProfileVM[];
    resources: LearningSpaceLinkVM[];
    schedules: RecurrenceFormData[];
    liveSession?: ChannelLiveSessionConfigVM | null;
  } | null;
  onSuccess?: () => void;
};

type LearningSpaceFormState = {
  kind: string;
  title: string;
  subject: string;
  description: string;
  iconKey: LearningSpaceIconKey;
  uiDefaults: ChannelUiDefaultsVM;
  participants: UserProfileVM[];
  resources: LearningSpaceLinkVM[];
  schedules: RecurrenceFormData[];
  liveSession: ChannelLiveSessionConfigVM;
};

function createDefaultChannelUiDefaults(): ChannelUiDefaultsVM {
  return {
    themeKey: 'teal',
    defaultRightPanelOpen: true,
    defaultRightPanelKey: 'channel_info',
    infoPanel: {
      showHeader: true,
      showDetails: true,
      showMedia: true,
      showMembers: true,
      showQuickActions: true,
      showHiddenQuickActions: false,
    },
  };
}

export function LearningSpaceFormDialog({
  participantOptions = [],
  defaultScheduleTimezone,
  mode = 'create',
  open: openProp,
  onOpenChange,
  initialData,
  onSuccess,
}: LearningSpaceFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const isControlled = openProp !== undefined;
  const dialogOpen = isControlled ? openProp : open;
  const setDialogOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (isControlled) {
        onOpenChange?.(nextOpen);
      } else {
        setOpen(nextOpen);
      }
    },
    [isControlled, onOpenChange],
  );
  const initialState = React.useMemo<LearningSpaceFormState>(
    () => ({
      kind: KIND_OPTIONS[0].value,
      title: '',
      subject: '',
      description: '',
      iconKey: DEFAULT_LEARNING_SPACE_ICON_KEY,
      uiDefaults: createDefaultChannelUiDefaults(),
      participants: [],
      resources: [],
      schedules: [],
      liveSession: { ...DEFAULT_ADMIN_LIVE_SESSION_CONFIG },
    }),
    [],
  );
  const [formState, setFormState] = React.useState<LearningSpaceFormState>(initialState);
  const [editingId, setEditingId] = React.useState<string | null>(null);
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
  const iconInvalid = isSubmitted && !formState.iconKey;
  const titleInvalid = isSubmitted && !formState.title.trim();
  const kindInvalid = isSubmitted && !formState.kind;
  const participantsInvalid = isSubmitted && formState.participants.length === 0;

  React.useEffect(() => {
    if (!dialogOpen) {
      return;
    }
    if (mode === 'edit' && initialData) {
      setEditingId(initialData.ids.id);
      setFormState({
        kind: initialData.basics.kind,
        title: initialData.basics.title,
        subject: initialData.basics.subject ?? '',
        description: initialData.basics.description ?? '',
        iconKey: (initialData.basics.iconKey ??
          DEFAULT_LEARNING_SPACE_ICON_KEY) as LearningSpaceIconKey,
        uiDefaults: {
          ...createDefaultChannelUiDefaults(),
          ...(initialData.settings?.uiDefaults ?? {}),
          themeKey: (initialData.settings?.themeKey ?? 'teal') as ThemeKey,
        },
        participants: initialData.participants ?? [],
        resources: initialData.resources ?? [],
        schedules: normalizeSchedules(initialData.schedules ?? []),
        liveSession: initialData.liveSession ?? { ...DEFAULT_ADMIN_LIVE_SESSION_CONFIG },
      });
      setIsSubmitted(false);
      return;
    }
    if (mode === 'create' && dialogOpen) {
      setFormState(initialState);
      setEditingId(null);
      setIsSubmitted(false);
    }
  }, [dialogOpen, initialData, mode, initialState]);

  const resetForm = () => {
    setFormState(initialState);
    setEditingId(null);
    setIsSubmitted(false);
  };

  const updateFormState = (updates: Partial<LearningSpaceFormState>) => {
    setFormState((prev) => ({ ...prev, ...updates }));
  };

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
      resources: mapLinksToPayload(formState.resources),
      schedules: mapSchedulesToPayload(formState.schedules),
    };

    setIsSaving(true);
    try {
      const endpoint =
        mode === 'edit' ? '/api/admin/spaces/update' : '/api/admin/spaces/create';
      const body =
        mode === 'edit'
          ? JSON.stringify({
              learningSpaceId: editingId,
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
      setDialogOpen(false);
      resetForm();
      router.refresh();
      onSuccess?.();
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
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {mode === 'create' && !isControlled && (
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm" className="flex items-center gap-2">
            <Plus className="size-4" />
            Add new
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="w-[min(95vw,60rem)] sm:max-w-[min(95vw,60rem)] max-w-none overflow-hidden p-0">
        <div className="flex max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <div className="px-6 py-5">
            <DialogHeader>
              <DialogTitle>
                {mode === 'edit' ? 'Edit classroom' : 'Create classroom'}
              </DialogTitle>
              <DialogDescription>
                {mode === 'edit'
                  ? 'Update the basics, participants, and resources for the classroom.'
                  : 'Configure the basics, invite participants, and attach resources for the classroom.'}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <ScrollArea className="flex flex-1 flex-col min-h-0">
              <form
                id="learning-space-form"
                onSubmit={handleSubmit}
                className="flex w-full flex-1 flex-col gap-4 px-6 pb-6 pt-2 min-h-0"
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
                          updateFormState({ iconKey: value as LearningSpaceIconKey })
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
                          Please choose an icon for this classroom.
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
                        onChange={(event) =>
                          updateFormState({ title: event.target.value })
                        }
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
                        onValueChange={(value) => updateFormState({ subject: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select subject" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Subjects</SelectLabel>
                            {SUBJECT_OPTIONS.map((option) => (
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
                        onValueChange={(value) => updateFormState({ kind: value })}
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
                          Kind is required for the classroom.
                        </FieldDescription>
                      )}
                    </Field>
                  </FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="ls-description">Description</FieldLabel>
                    <Textarea
                      id="ls-description"
                      value={formState.description}
                      onChange={(event) =>
                        updateFormState({ description: event.target.value })
                      }
                      rows={3}
                    />
                  </Field>
                </FieldSet>
                <FieldSeparator />
                <FieldSet>
                  <ResourceLinksEditor
                    links={formState.resources}
                    onLinksChange={(nextLinks) =>
                      updateFormState({ resources: nextLinks })
                    }
                  />
                </FieldSet>
                <FieldSeparator />
                <LiveSessionSettingsSection
                  description="Configure the primary channel’s live session provider and mode for this classroom."
                  providerSelectId="ls-live-session-provider"
                  modeSelectId="ls-live-session-mode"
                  joinUrlInputId="ls-live-session-join-url"
                  value={formState.liveSession}
                  onChange={(nextLiveSession) =>
                    updateFormState({
                      liveSession: nextLiveSession,
                    })
                  }
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
                        updateFormState({
                          participants: formState.participants.some(
                            (item) => item.ids.id === user.ids.id,
                          )
                            ? formState.participants
                            : [...formState.participants, user],
                        })
                      }
                      onUserRemove={(user) =>
                        updateFormState({
                          participants: formState.participants.filter(
                            (item) => item.ids.id !== user.ids.id,
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
                    onSchedulesChange={(nextSchedules) =>
                      updateFormState({ schedules: nextSchedules })
                    }
                  />
                </FieldSet>
                <FieldSeparator />
                <ChannelUiDefaultsSettingsSection
                  legend="Settings"
                  themeSelectId="ls-theme-key"
                  description="Sets the accent color used across this classroom message UI."
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
              </form>
              <ScrollBar orientation="vertical" className="right-2" />
            </ScrollArea>
            <div className="border-t border-border bg-card px-6 py-4">
              <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setDialogOpen(false)}
                  type="button"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="learning-space-form"
                  className="w-full sm:w-auto"
                  disabled={isSaving}
                >
                  {isSaving
                    ? mode === 'edit'
                      ? 'Saving...'
                      : 'Creating...'
                    : mode === 'edit'
                      ? 'Save changes'
                      : 'Create space'}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

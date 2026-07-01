'use client';

import * as React from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AdminFilterBar } from '@iconicedu/web/components/admin/admin-filter-bar';
import {
  Button,
  Loader2,
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
  Label,
  Checkbox,
  Textarea,
  Plus,
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

import type { AdminChannelRow } from '@iconicedu/web/lib/admin/channels';
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
import { ChannelsTable } from '@iconicedu/web/app/(app)/[orgSlug]/admin/channels/channels-table';
import { LiveSessionSettingsSection } from '@iconicedu/web/components/admin/live-session-settings-section';
import { withInfoPanelDisabled } from '@iconicedu/web/lib/channels/ui-defaults';
import { DEFAULT_ADMIN_LIVE_SESSION_CONFIG } from '@iconicedu/web/lib/admin/live-session-config';

const PAGE_SIZE = 10;
const NO_CHANNEL_ICON_VALUE = '__none__';

type ChannelsDashboardProps = {
  orgSlug: string;
};

type CreateChannelFormState = {
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

export function ChannelsDashboard({ orgSlug }: ChannelsDashboardProps) {
  // Lazy-load state
  const [rows, setRows] = React.useState<AdminChannelRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [pageIndex, setPageIndex] = React.useState(1);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [participantOptions, setParticipantOptions] = React.useState<UserProfileVM[]>([]);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [formState, setFormState] = React.useState<CreateChannelFormState>({
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
  });

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    setPageIndex(1);
  }, [debouncedSearch, typeFilter]);

  const fetchPage = React.useCallback(
    async (page: number) => {
      setLoading(true);
      setFetchError(null);
      try {
        const params = new URLSearchParams({
          orgSlug,
          page: String(page),
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(typeFilter !== 'all' ? { kind: typeFilter } : {}),
        });
        const res = await fetch(`/api/admin/channels/list?${params.toString()}`);
        const json = (await res.json()) as {
          success?: boolean;
          message?: string;
          rows?: AdminChannelRow[];
          total?: number;
          pageCount?: number;
        };
        if (!res.ok || !json.success) throw new Error(json.message ?? 'Failed to load');
        setRows(json.rows ?? []);
        setTotal(json.total ?? 0);
        setPageCount(json.pageCount ?? 1);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Failed to load channels');
      } finally {
        setLoading(false);
      }
    },
    [orgSlug, debouncedSearch, typeFilter],
  );

  React.useEffect(() => {
    void fetchPage(pageIndex);
  }, [fetchPage, pageIndex]);

  const loadParticipants = React.useCallback(async () => {
    try {
      const response = await fetch('/api/admin/channels/participants', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        setParticipantOptions([]);
        return;
      }
      const payload = (await response.json()) as { data?: UserProfileVM[] };
      setParticipantOptions(payload.data ?? []);
    } catch {
      setParticipantOptions([]);
    }
  }, []);

  React.useEffect(() => {
    void loadParticipants();
  }, [loadParticipants]);

  const updateFormState = (patch: Partial<CreateChannelFormState>) => {
    setFormState((prev) => ({ ...prev, ...patch }));
  };

  const resetCreateForm = () => {
    setFormState({
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
    });
    setCreateError(null);
    setIsSubmitted(false);
  };

  const handleSubmit = async () => {
    setIsSubmitted(true);
    if (!formState.topic.trim()) {
      setCreateError('Channel name is required.');
      return;
    }
    setIsCreating(true);
    setCreateError(null);
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
        ui: {
          ...formState.uiDefaults,
          themeKey: formState.uiDefaults.themeKey ?? null,
        },
        liveSession: formState.liveSession.enabled ? formState.liveSession : null,
        postingPolicy: {
          kind: formState.postingPolicyKind,
          allowThreads: formState.allowThreads,
          allowReactions: formState.allowReactions,
        },
        lifecycle: { status: formState.status },
        participants: formState.participants.map((participant) => ({
          profileId: participant.ids.id,
          roleInChannel: null,
        })),
        capabilities: formState.capabilities,
      };
      const response = await fetch('/api/admin/channels/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload),
      });
      const responsePayload = (await response.json()) as {
        success?: boolean;
        message?: string;
      };
      if (!response.ok || !responsePayload.success) {
        setCreateError(responsePayload.message ?? 'Unable to create channel.');
        return;
      }
      setDialogOpen(false);
      resetCreateForm();
      void fetchPage(pageIndex);
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : 'Unable to create channel.',
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Channels</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and manage all channels across the organisation.
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetCreateForm();
          }}
        >
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="flex items-center gap-2"
              onClick={() => {
                resetCreateForm();
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add new
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Create channel</DialogTitle>
              <DialogDescription>
                Create a new channel that will appear in the admin list.
              </DialogDescription>
            </DialogHeader>
            <div className="no-scrollbar -mx-4 max-h-[65vh] overflow-y-auto px-4">
              <div className="grid gap-4 py-2">
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
                        onChange={(event) =>
                          updateFormState({ topic: event.target.value })
                        }
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
                        disabled={false}
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
                        disabled={false}
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
                            iconKey: value as
                              | ChannelTopicIconKey
                              | typeof NO_CHANNEL_ICON_VALUE,
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
                        Optional. Useful for support, public, private, parent, or other
                        group channels.
                      </FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="channel-description">Description</FieldLabel>
                      <Textarea
                        id="channel-description"
                        value={formState.description}
                        onChange={(event) =>
                          updateFormState({ description: event.target.value })
                        }
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
                  onChange={(nextLiveSession) =>
                    updateFormState({ liveSession: nextLiveSession })
                  }
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
                </FieldSet>
                <FieldSeparator />
                <FieldSet>
                  <FieldLegend>Capabilities</FieldLegend>
                  <FieldDescription>
                    Enable optional features for this channel.
                  </FieldDescription>
                  <FieldGroup>
                    <div className="flex flex-col gap-2">
                      {(
                        [
                          'has_schedule',
                          'has_homework',
                          'has_summaries',
                        ] as ChannelCapabilityVM[]
                      ).map((capability) => (
                        <Label
                          key={capability}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={formState.capabilities.includes(capability)}
                            onCheckedChange={(checked) =>
                              updateFormState({
                                capabilities:
                                  checked === true
                                    ? formState.capabilities.includes(capability)
                                      ? formState.capabilities
                                      : [...formState.capabilities, capability]
                                    : formState.capabilities.filter(
                                        (item) => item !== capability,
                                      ),
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
                {createError ? (
                  <p className="text-sm text-destructive">{createError}</p>
                ) : null}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isCreating}>
                {isCreating ? 'Creating…' : 'Create channel'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <AdminFilterBar
        search={search}
        onSearchChange={setSearch}
        filterGroups={[
          {
            label: 'Type',
            value: typeFilter,
            options: [
              { value: 'all', label: 'All' },
              { value: 'channel', label: 'Channel' },
              { value: 'dm', label: 'DM' },
              { value: 'group_dm', label: 'Group DM' },
            ],
            onChange: setTypeFilter,
          },
        ]}
      />

      <div className="rounded-xl border overflow-hidden">
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 rounded-xl bg-card/90 flex items-center justify-center z-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
            <h2 className="text-sm font-semibold">Channels ({total})</h2>
          </div>
          {fetchError ? (
            <p className="px-6 py-10 text-center text-sm text-destructive">
              {fetchError}
            </p>
          ) : !loading && rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No channels found.
            </p>
          ) : (
            <ChannelsTable rows={rows} orgSlug={orgSlug} />
          )}
        </div>
        {total > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t">
            <p className="text-xs text-muted-foreground">
              {(pageIndex - 1) * PAGE_SIZE + 1}–{Math.min(pageIndex * PAGE_SIZE, total)}{' '}
              of {total}
            </p>
            {pageCount > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={pageIndex <= 1}
                  onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-xs text-muted-foreground">
                  Page {pageIndex} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={pageIndex >= pageCount}
                  onClick={() => setPageIndex((p) => Math.min(pageCount, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

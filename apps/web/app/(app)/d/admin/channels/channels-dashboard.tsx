'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Button,
  Checkbox,
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
  Textarea,
  Label,
  Plus,
  ParticipantSelector,
  RotateCw,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web';

import type { AdminChannelRow } from '@iconicedu/web/lib/admin/channels';
import type {
  ChannelCapabilityVM,
  ChannelKind,
  ChannelPurpose,
  ChannelStatus,
  ChannelVisibility,
  ChannelCreatePayload,
  ChannelPostingPolicyVM,
  UserProfileVM,
} from '@iconicedu/shared-types';
import { ChannelsTable } from '@iconicedu/web/app/(app)/d/admin/channels/channels-table';
import type { ChannelDetail } from '@iconicedu/web/lib/admin/channel-detail';

const PAGE_SIZES = [10, 25, 50];

type ChannelsDashboardProps = {
  rows: AdminChannelRow[];
};

type CreateChannelFormState = {
  topic: string;
  description: string;
  kind: string;
  purpose: string;
  visibility: string;
  status: ChannelStatus;
  postingPolicyKind: ChannelPostingPolicyVM['kind'];
  allowThreads: boolean;
  allowReactions: boolean;
  participants: UserProfileVM[];
  capabilities: ChannelCapabilityVM[];
};

export function ChannelsDashboard({ rows }: ChannelsDashboardProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<'all' | string>('all');
  const [pageIndex, setPageIndex] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZES[0]);
  const [isPending, startTransition] = React.useTransition();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [participantOptions, setParticipantOptions] = React.useState<UserProfileVM[]>([]);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [formState, setFormState] = React.useState<CreateChannelFormState>({
    topic: '',
    description: '',
    kind: 'channel',
    purpose: 'general',
    visibility: 'private',
    status: 'active',
    postingPolicyKind: 'members-only',
    allowThreads: true,
    allowReactions: true,
    participants: [],
    capabilities: [],
  });

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
    setPageIndex(1);
  }, [search, typeFilter, pageSize]);

  React.useEffect(() => {
    void loadParticipants();
  }, [loadParticipants]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredRows = React.useMemo(() => {
    return rows.filter((row) => {
      if (typeFilter !== 'all' && row.kind !== typeFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      if (row.topic?.toLowerCase().includes(normalizedSearch)) {
        return true;
      }
      if (row.purpose?.toLowerCase().includes(normalizedSearch)) {
        return true;
      }
      if (row.kind?.toLowerCase().includes(normalizedSearch)) {
        return true;
      }
      return false;
    });
  }, [rows, normalizedSearch, typeFilter]);

  const sortedRows = React.useMemo(() => {
    const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
    return [...filteredRows].sort((a, b) => collator.compare(a.topic, b.topic));
  }, [filteredRows]);

  const totalRows = sortedRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const visibleRows = sortedRows.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);

  const handleRefresh = () => {
    startTransition(() => router.refresh());
    void loadParticipants();
  };

  const updateFormState = (patch: Partial<CreateChannelFormState>) => {
    setFormState((prev) => ({ ...prev, ...patch }));
  };

  const resetCreateForm = () => {
    setFormState({
      topic: '',
      description: '',
      kind: 'channel',
      purpose: 'general',
      visibility: 'private',
      status: 'active',
      postingPolicyKind: 'members-only',
      allowThreads: true,
      allowReactions: true,
      participants: [],
      capabilities: [],
    });
    setCreateError(null);
    setIsSubmitted(false);
    setEditingId(null);
  };

  const applyDetailToForm = (detail: ChannelDetail) => {
    setFormState({
      topic: detail.basics.topic ?? '',
      description: detail.basics.description ?? '',
      kind: detail.basics.kind,
      purpose: detail.basics.purpose,
      visibility: detail.basics.visibility,
      status: detail.lifecycle.status,
      postingPolicyKind: detail.postingPolicy.kind,
      allowThreads: detail.postingPolicy.allowThreads ?? true,
      allowReactions: detail.postingPolicy.allowReactions ?? true,
      participants: detail.participants ?? [],
      capabilities: detail.capabilities ?? [],
    });
  };

  const handleEdit = async (row: AdminChannelRow) => {
    try {
      const response = await fetch('/api/admin/channels/detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: row.id }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        message?: string;
        data?: ChannelDetail;
      };
      if (!response.ok || !payload.success || !payload.data) {
        setCreateError(payload.message ?? 'Unable to load channel.');
        return;
      }
      applyDetailToForm(payload.data);
      setEditingId(row.id);
      setDialogMode('edit');
      setDialogOpen(true);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Unable to load channel.');
    }
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
          iconKey: null,
          description: formState.description.trim() || null,
          visibility: formState.visibility as ChannelVisibility,
          purpose: formState.purpose as ChannelPurpose,
        },
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
      const endpoint =
        dialogMode === 'edit'
          ? '/api/admin/channels/update'
          : '/api/admin/channels/create';
      const body =
        dialogMode === 'edit'
          ? JSON.stringify({ channelId: editingId, payload: createPayload })
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
        setCreateError(responsePayload.message ?? 'Unable to create channel.');
        return;
      }
      setDialogOpen(false);
      resetCreateForm();
      handleRefresh();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Unable to create channel.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              resetCreateForm();
              setDialogMode('create');
            }
          }}
        >
          <DialogTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => {
                setDialogMode('create');
                resetCreateForm();
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              Create channel
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {dialogMode === 'edit' ? 'Edit channel' : 'Create channel'}
              </DialogTitle>
              <DialogDescription>
                {dialogMode === 'edit'
                  ? 'Update the channel details and memberships.'
                  : 'Create a new channel that will appear in the admin list.'}
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
                      onChange={(event) => updateFormState({ topic: event.target.value })}
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
                      disabled={dialogMode === 'edit'}
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
                      disabled={dialogMode === 'edit'}
                    >
                      <SelectTrigger id="channel-purpose">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="learning-space">Learning space</SelectItem>
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
                        updateFormState({ postingPolicyKind: value as ChannelPostingPolicyVM['kind'] })
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
                          updateFormState({ allowThreads: Boolean(checked) })
                        }
                      />
                      Allow threads
                    </Label>
                    <Label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={formState.allowReactions}
                        onCheckedChange={(checked) =>
                          updateFormState({ allowReactions: Boolean(checked) })
                        }
                      />
                      Allow reactions
                    </Label>
                  </div>
                </FieldGroup>
              </FieldSet>
              <FieldSeparator />
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
                    {(['has_schedule', 'has_homework', 'has_summaries'] as ChannelCapabilityVM[]).map(
                      (capability) => (
                        <Label key={capability} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={formState.capabilities.includes(capability)}
                            onCheckedChange={(checked) =>
                              updateFormState({
                                capabilities: Boolean(checked)
                                  ? formState.capabilities.includes(capability)
                                    ? formState.capabilities
                                    : [...formState.capabilities, capability]
                                  : formState.capabilities.filter((item) => item !== capability),
                              })
                            }
                          />
                          {capability.replace('has_', '').replace('_', ' ')}
                        </Label>
                      ),
                    )}
                  </div>
                </FieldGroup>
              </FieldSet>
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
                {isCreating
                  ? dialogMode === 'edit'
                    ? 'Saving…'
                    : 'Creating…'
                  : dialogMode === 'edit'
                    ? 'Save changes'
                    : 'Create channel'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search name or type"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-64"
          />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Type:</span>
            <Select
              value={typeFilter}
              onValueChange={(value) => setTypeFilter(value as 'all' | string)}
            >
              <SelectTrigger size="sm" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="channel">Channel</SelectItem>
                <SelectItem value="dm">DM</SelectItem>
                <SelectItem value="group_dm">Group DM</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="px-2"
          onClick={handleRefresh}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <RotateCw className="size-4 transition-transform" />
          )}
        </Button>
      </div>

      <div className="relative">
        {isPending ? (
          <div className="absolute inset-0 rounded-2xl border border-border bg-card/70 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : null}
        <ChannelsTable rows={visibleRows} onEdit={handleEdit} />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Page size</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => setPageSize(Number(value))}
          >
            <SelectTrigger size="sm" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPageIndex((prev) => Math.max(1, prev - 1))}
            disabled={pageIndex <= 1}
          >
            Previous
          </Button>
          <span>
            Page {pageIndex} of {pageCount}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPageIndex((prev) => Math.min(pageCount, prev + 1))}
            disabled={pageIndex >= pageCount}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

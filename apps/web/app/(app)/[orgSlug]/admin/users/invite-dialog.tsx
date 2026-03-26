'use client';

import * as React from 'react';
import { Copy } from '@iconicedu/ui-web';
import { useRouter } from 'next/navigation';
import { toast } from '@iconicedu/ui-web';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web';

import { inviteAdminUserAction } from '@iconicedu/web/app/(app)/[orgSlug]/admin/users/actions/invite-user';

export function InviteUserDialog({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [profileKind, setProfileKind] = React.useState<'guardian' | 'educator' | 'staff'>(
    'guardian',
  );
  const [generatedInviteUrl, setGeneratedInviteUrl] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement | null>(null);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setErrorMessage(null);
      formRef.current?.reset();
      setGeneratedInviteUrl(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    formData.set('mode', 'invite');
    formData.set('linkType', 'invite');
    try {
      const result = await inviteAdminUserAction(formData);
      const inviteLink = result.actionLink ?? result.inviteUrl;
      if (inviteLink) {
        setGeneratedInviteUrl(inviteLink);
      }
      toast.success('Invite email sent');
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to send magic link at this time.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyInviteUrl = async () => {
    if (!generatedInviteUrl) {
      return;
    }

    if (!navigator?.clipboard?.writeText) {
      toast.error('Clipboard not available');
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedInviteUrl);
      toast.success('Invite link copied');
    } catch {
      toast.error('Unable to copy invite link');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={className ?? 'flex items-center gap-2'}
          type="button"
        >
          <Copy className="size-4" />
          Invite users
        </Button>
      </DialogTrigger>
      <DialogContent className="space-y-4 sm:max-w-[42rem]">
        <DialogHeader>
          <DialogTitle>Invite guardians, educators, or staff</DialogTitle>
          <DialogDescription>
            Send a Supabase invite email or copy the invite URL to share it manually.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              required
              disabled={isSubmitting}
              placeholder="user@example.com"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="invite-kind">Type</Label>
            <Select
              name="profileKind"
              value={profileKind}
              onValueChange={(value) =>
                setProfileKind(value as 'guardian' | 'educator' | 'staff')
              }
              disabled={isSubmitting}
            >
              <SelectTrigger id="invite-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['guardian', 'educator', 'staff'] as const).map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    <span className="capitalize">{kind}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {errorMessage ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : null}
          {generatedInviteUrl && (
            <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-xs text-muted-foreground break-words"
                  style={{ wordBreak: 'break-word' }}
                >
                  {generatedInviteUrl}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2"
                  onClick={handleCopyInviteUrl}
                  disabled={isSubmitting}
                  type="button"
                >
                  <Copy className="size-4" />
                  <span className="sr-only">Copy invite link</span>
                </Button>
              </div>
            </div>
          )}
          <DialogFooter className="space-x-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Send invite email'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { Badge } from '@iconicedu/ui-web';
import { Avatar, AvatarFallback, AvatarImage } from '@iconicedu/ui-web/ui/avatar';
import { Users } from 'lucide-react';
import type {
  AdminFamilyRow,
  AdminFamilyParticipant,
} from '@iconicedu/web/lib/admin/families';

type FamiliesTableProps = {
  rows: AdminFamilyRow[];
};

function getInitials(name: string) {
  return (name.trim()[0] ?? '?').toUpperCase();
}

function MemberChip({ participant }: { participant: AdminFamilyParticipant }) {
  const name = participant.name ?? participant.label;
  const themeClass = participant.themeKey ? `theme-${participant.themeKey}` : '';

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-foreground">
      <Avatar className={`size-5 shrink-0 ${themeClass}`}>
        {participant.avatarUrl ? (
          <AvatarImage src={participant.avatarUrl} alt={name} />
        ) : null}
        <AvatarFallback className={themeClass ? 'theme-bg theme-fg' : ''}>
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <span className="max-w-[120px] truncate">{name}</span>
    </span>
  );
}

export function FamiliesTable({ rows }: FamiliesTableProps) {
  if (!rows.length) {
    return (
      <p className="px-6 py-10 text-center text-sm text-muted-foreground">
        No families found.
      </p>
    );
  }

  return (
    <div className="w-full">
      {rows.map((row) => (
        <div
          key={row.familyId}
          className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border/60 last:border-b-0 hover:bg-muted/30 transition-colors"
        >
          {/* Left: family icon + name + member chips */}
          <div className="min-w-0 flex-1 flex items-start gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
              <Users className="size-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 flex flex-col gap-1.5">
              <p className="text-sm font-semibold leading-tight">{row.displayName}</p>
              {(row.guardians.length > 0 || row.children.length > 0) && (
                <div className="flex flex-wrap gap-1.5 -ml-2">
                  {row.guardians.map((guardian) => (
                    <MemberChip key={guardian.id} participant={guardian} />
                  ))}
                  {row.children.map((child) => (
                    <MemberChip key={child.id} participant={child} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: member count + pending invites */}
          <div className="flex shrink-0 flex-col items-end gap-2 pt-1">
            <Badge variant="secondary" className="text-xs gap-1">
              <Users className="size-3" />
              {row.familyLinkCount} {row.familyLinkCount === 1 ? 'member' : 'members'}
            </Badge>
            {row.pendingInvites.length > 0 && (
              <div className="flex flex-col items-end gap-1">
                {row.pendingInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground max-w-[140px] truncate">
                      {invite.invitedEmail ?? invite.invitedPhone ?? 'Invited'}
                    </span>
                    <Badge
                      variant={invite.status === 'pending' ? 'outline' : 'secondary'}
                      className="text-[11px] px-2 capitalize"
                    >
                      {invite.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

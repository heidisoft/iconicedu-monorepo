import { Phone, PhoneOff, Users } from 'lucide-react';
import { IconActionButton } from '@iconicedu/ui-web/ui/icon-action-button';
import type { ClassroomRosterVM } from '@iconicedu/shared-types';
export function ZoomClassRoster({
  roster,
  error,
  pending,
  call,
  cancel,
}: {
  roster: ClassroomRosterVM | null;
  error: string | null;
  pending: string | null;
  call: (profileId: string) => Promise<void>;
  cancel: (id: string) => Promise<void>;
}) {
  if (!roster?.enabled) return null;
  const absent = roster.members.filter((member) => !member.joined);
  return (
    <section className="mb-5 space-y-2" aria-label="Class members not in meeting">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Users className="size-4" />
        Not in meeting ({absent.length})
      </h3>
      {roster.callingUnavailableReason && (
        <p className="text-xs text-muted-foreground">{roster.callingUnavailableReason}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {absent.map((member) => {
        const ringing =
          member.call?.status === 'ringing' &&
          Date.parse(member.call.expiresAt) > Date.now();
        const status = member.joined
          ? 'In meeting'
          : ringing
            ? 'Ringing…'
            : member.call?.status === 'accepted'
              ? 'Joining…'
              : member.call?.status === 'declined'
                ? 'Declined'
                : member.call?.status === 'expired'
                  ? 'No answer'
                  : 'Not in meeting';
        return (
          <div key={member.profileId} className="flex min-h-14 items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{member.displayName}</p>
              <p className="text-xs text-muted-foreground">{status}</p>
            </div>
            {member.canCall && (
              <IconActionButton
                label={`${ringing ? 'Cancel call to' : 'Call'} ${member.displayName}`}
                disabled={pending !== null}
                variant="secondary"
                className="size-11 rounded-full"
                onClick={() => {
                  void (ringing && member.call
                    ? cancel(member.call.id)
                    : call(member.profileId));
                }}
              >
                {ringing ? <PhoneOff /> : <Phone />}
              </IconActionButton>
            )}
          </div>
        );
      })}
    </section>
  );
}

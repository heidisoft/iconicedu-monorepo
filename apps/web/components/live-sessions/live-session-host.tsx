'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Loader2, MonitorUp } from 'lucide-react';

import type { LiveSessionProviderVM } from '@iconicedu/shared-types';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  canEmbedLiveSession,
  getEmbeddedLiveSessionFrameAllow,
  getEmbeddedLiveSessionTitle,
} from '@iconicedu/web/lib/live-sessions/embed';
import { getLiveSessionHostHeading } from '@iconicedu/ui-web/components/live-sessions/live-session-host.utils';
import type { LinkedChildProfile } from '@iconicedu/ui-web/components/live-sessions/daily-live-session-embed';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import {
  loadWhiteboardSnapshot,
  saveWhiteboardSnapshot,
} from '@iconicedu/web/lib/whiteboard/whiteboard-snapshot';

const DailyLiveSessionEmbed = dynamic(
  () =>
    import('@iconicedu/ui-web/components/live-sessions/daily-live-session-embed').then(
      (module) => module.DailyLiveSessionEmbed,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading live session...
        </div>
      </div>
    ),
  },
);

const ClassroomWhiteboard = dynamic(
  () =>
    import('@iconicedu/web/components/live-sessions/whiteboard/classroom-whiteboard').then(
      (module) => module.ClassroomWhiteboard,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading whiteboard...
        </div>
      </div>
    ),
  },
);

export function LiveSessionHost({
  provider,
  joinUrl,
  token,
  externalJoinUrl,
  channelKind,
  channelId,
  mode,
  channelTopic,
  channelPurpose,
  returnPath,
  liveSessionId,
  orgId,
  profileId,
  userName,
  userAvatarUrl,
  linkedChildren,
  isPresenter,
  whiteboardEnabled,
}: {
  provider: LiveSessionProviderVM;
  joinUrl?: string | null;
  token?: string | null;
  externalJoinUrl?: string | null;
  channelKind?: string | null;
  channelId?: string | null;
  mode?: 'video' | 'audio' | null;
  channelTopic?: string | null;
  channelPurpose?: string | null;
  returnPath: string;
  liveSessionId?: string | null;
  orgId?: string | null;
  profileId?: string | null;
  userName?: string | null;
  userAvatarUrl?: string | null;
  linkedChildren?: LinkedChildProfile[];
  isPresenter?: boolean;
  whiteboardEnabled?: boolean;
}) {
  const router = useRouter();
  const heading = getLiveSessionHostHeading({ provider, channelTopic });
  const supabase = createSupabaseBrowserClient();

  const showWhiteboard = whiteboardEnabled && provider === 'daily' && !!liveSessionId;

  const whiteboardSlot =
    showWhiteboard && liveSessionId && orgId && profileId ? (
      <ClassroomWhiteboard
        liveSessionId={liveSessionId}
        isPresenter={isPresenter ?? false}
        supabase={supabase}
        onLoadSnapshot={() => loadWhiteboardSnapshot(liveSessionId)}
        onSaveSnapshot={(elements) =>
          saveWhiteboardSnapshot(liveSessionId, orgId, channelId ?? '', { elements })
        }
      />
    ) : undefined;

  if (provider === 'daily' && joinUrl) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DailyLiveSessionEmbed
          joinUrl={joinUrl}
          token={token ?? null}
          externalJoinUrl={externalJoinUrl ?? null}
          channelKind={channelKind ?? null}
          mode={mode ?? null}
          returnPath={returnPath}
          meetingName={heading}
          userName={userName ?? null}
          userAvatarUrl={userAvatarUrl ?? null}
          linkedChildren={linkedChildren}
          liveSessionId={liveSessionId ?? null}
          channelId={channelId ?? null}
          contentSlot={whiteboardSlot}
          whiteboardEnabled={showWhiteboard}
          onLeave={(path) => router.push(path)}
        />
      </div>
    );
  }

  if (!canEmbedLiveSession(joinUrl)) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">{heading}</h1>
        <p className="text-sm text-muted-foreground">
          This provider did not return an embeddable join URL.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{heading}</h1>
          <p className="text-sm text-muted-foreground">
            {channelPurpose ?? 'Live session'}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a
            href={externalJoinUrl ?? joinUrl ?? undefined}
            target="_blank"
            rel="noreferrer"
          >
            <MonitorUp className="h-4 w-4" />
            Open in new tab
          </a>
        </Button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-card">
        <iframe
          title={getEmbeddedLiveSessionTitle(provider)}
          src={joinUrl ?? undefined}
          className="h-full min-h-[70vh] w-full border-0"
          allow={getEmbeddedLiveSessionFrameAllow(provider)}
          allowFullScreen
        />
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import { DashboardHeader } from '@iconicedu/ui-web';
import {
  getDashboardAccountContext,
  getDashboardProfileContext,
} from '@iconicedu/web/app/(app)/[orgSlug]/_shared/dashboard-auth';
import { LiveSessionHost } from '@iconicedu/web/components/live-sessions/live-session-host';
import { getLiveSessionReturnPath } from '@iconicedu/ui-web/components/live-sessions/live-session-host.utils';
import type { LinkedChildProfile } from '@iconicedu/ui-web/components/live-sessions/daily-live-session-embed';
import { resolveLiveSessionJoinAccess } from '@iconicedu/web/lib/live-sessions/service';
import { createSupabaseServiceClient } from '@iconicedu/web/lib/supabase/service';
import { enableClassroomWhiteboard } from '@iconicedu/web/flags';

function parseLiveSessionMode(value: unknown): 'video' | 'audio' | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  return candidate.mode === 'audio' || candidate.mode === 'video' ? candidate.mode : null;
}

export const metadata: Metadata = {
  title: 'Live Session',
  description:
    'Join your live tutoring session and return to the related conversation when finished.',
};

export default async function Page({
  params,
}: {
  params: Promise<{ orgSlug: string; sessionId: string }>;
}) {
  const { orgSlug, sessionId } = await params;
  const { supabase, account } = await getDashboardAccountContext(orgSlug);
  const { profileResponse } = await getDashboardProfileContext(supabase, account.id);

  if (!profileResponse.data) {
    throw new Error('Profile not found');
  }

  try {
    const serviceSupabase = createSupabaseServiceClient();
    const { joinAccess, session } = await resolveLiveSessionJoinAccess({
      serviceSupabase,
      liveSessionId: sessionId,
      profile: profileResponse.data,
    });
    const whiteboardEnabled =
      session.provider === 'daily' &&
      (await enableClassroomWhiteboard.run({
        identify: { profileId: profileResponse.data.id },
      }));

    const channelResponse = await serviceSupabase
      .from('channels')
      .select('topic, purpose, kind, live_session_config')
      .eq('id', session.channel_id)
      .eq('org_id', session.org_id)
      .is('deleted_at', null)
      .maybeSingle<{
        topic: string;
        purpose: string;
        kind: string;
        live_session_config?: Record<string, unknown> | null;
      }>();
    const returnPath = getLiveSessionReturnPath({
      orgSlug,
      channelId: session.channel_id,
      channelKind: channelResponse.data?.kind ?? null,
      channelPurpose: channelResponse.data?.purpose ?? null,
    });

    const isPresenter =
      profileResponse.data.kind === 'educator' || profileResponse.data.kind === 'staff';

    const whiteboardRole =
      profileResponse.data.kind === 'educator' || profileResponse.data.kind === 'staff'
        ? ('teacher' as const)
        : profileResponse.data.kind === 'guardian'
          ? ('observer' as const)
          : ('student' as const);

    // For guardian accounts, resolve linked children so the pre-join screen shows
    // the child's identity and lets the parent switch between children if there are multiple.
    let linkedChildren: LinkedChildProfile[] = [];
    if (profileResponse.data.kind === 'guardian' && profileResponse.data.account_id) {
      const familyLinksResponse = await serviceSupabase
        .from('family_links')
        .select('child_account_id')
        .eq('org_id', session.org_id)
        .eq('guardian_account_id', profileResponse.data.account_id)
        .is('deleted_at', null)
        .returns<Array<{ child_account_id: string | null }>>();

      const childAccountIds = (familyLinksResponse.data ?? [])
        .map((r) => r.child_account_id)
        .filter((id): id is string => Boolean(id));

      if (childAccountIds.length > 0) {
        // Only include children who are actual members of this session's channel.
        const childProfilesResponse = await serviceSupabase
          .from('profiles')
          .select(
            'id, display_name, first_name, last_name, avatar_url, channel_members!inner(channel_id)',
          )
          .in('account_id', childAccountIds)
          .eq('org_id', session.org_id)
          .eq('kind', 'child')
          .eq('channel_members.channel_id', session.channel_id)
          .is('channel_members.deleted_at', null)
          .is('deleted_at', null)
          .returns<
            Array<{
              id: string;
              display_name: string | null;
              first_name: string | null;
              last_name: string | null;
              avatar_url: string | null;
            }>
          >();

        linkedChildren = (childProfilesResponse.data ?? []).map((p) => ({
          id: p.id,
          displayName:
            p.display_name ??
            ([p.first_name, p.last_name].filter(Boolean).join(' ') || 'Child'),
          avatarUrl: p.avatar_url ?? null,
        }));
      }
    }

    return (
      <div className="flex h-[calc(100vh-1rem)] flex-col overflow-hidden">
        <DashboardHeader />
        <LiveSessionHost
          provider={session.provider as 'daily' | 'zoom' | 'jitsi' | 'custom'}
          joinUrl={joinAccess.joinUrl ?? null}
          token={joinAccess.token ?? null}
          externalJoinUrl={
            typeof joinAccess.metadata?.externalJoinUrl === 'string'
              ? joinAccess.metadata.externalJoinUrl
              : null
          }
          channelKind={channelResponse.data?.kind ?? null}
          channelId={session.channel_id}
          mode={parseLiveSessionMode(channelResponse.data?.live_session_config)}
          channelTopic={channelResponse.data?.topic ?? null}
          channelPurpose={channelResponse.data?.purpose ?? null}
          returnPath={returnPath}
          liveSessionId={session.id}
          orgId={session.org_id}
          profileId={profileResponse.data.id}
          userName={profileResponse.data.display_name}
          userAvatarUrl={profileResponse.data.avatar_url ?? null}
          linkedChildren={linkedChildren.length > 0 ? linkedChildren : undefined}
          isPresenter={isPresenter}
          whiteboardRole={whiteboardRole}
          whiteboardEnabled={whiteboardEnabled}
        />
      </div>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Live session unavailable';

    return (
      <div className="flex h-[calc(100vh-1rem)] flex-col">
        <DashboardHeader />
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-2xl font-semibold">Live session unavailable</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }
}

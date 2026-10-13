'use client';
import { useState } from 'react';
import { ZoomParticipantsPanel } from './zoom-participants-panel';
import {
  changeZoomCoHost,
  claimZoomSessionHost,
  type ZoomClient,
} from '@iconicedu/web/lib/live-sessions/zoom-session-lifecycle';
import { Button } from '@iconicedu/ui-web/ui/button';
/** SDK boundary only is synthetic; provider command guards and People UI are production. */
export function MeetingRolesFixture() {
  const [host, setHost] = useState(true);
  const [coHost, setCoHost] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(true);
  const client = {
    isHost: () => host,
    isOriginalHost: () => true,
    getCurrentUserInfo: () => ({ userId: 1, isHost: host }),
    makeManager: async () => {
      setCoHost(true);
      return '';
    },
    revokeManager: async () => {
      setCoHost(false);
      return '';
    },
    reclaimHost: async () => {
      setHost(true);
      return '';
    },
  } as unknown as ZoomClient;
  return (
    <main className="p-6">
      <h1>Meeting role controls</h1>
      <p role="status">{host ? 'You are host' : 'Another teacher is host'}</p>
      <Button
        onClick={() => {
          setHost(false);
          setOpen(false);
        }}
      >
        Simulate host transfer
      </Button>
      {!host && (
        <Button
          onClick={() =>
            void claimZoomSessionHost(client).catch((cause) => setError(String(cause)))
          }
        >
          Claim host
        </Button>
      )}
      {error && <p role="alert">{error}</p>}
      <ZoomParticipantsPanel
        open={open}
        onOpenChange={setOpen}
        canMuteOthers={host}
        canManageCoHosts={
          host && new URLSearchParams(window.location.search).get('cohosts') !== 'off'
        }
        onMute={() => undefined}
        onCoHost={(id, enabled) =>
          void changeZoomCoHost(client, id, enabled).catch((cause) =>
            setError(String(cause)),
          )
        }
        participants={[
          {
            userId: 1,
            name: 'Teacher',
            isYou: true,
            isHost: host,
            muted: false,
            videoOn: true,
            handRaised: false,
            isSpeaking: false,
          },
          {
            userId: 2,
            name: 'Staff',
            isYou: false,
            isHost: !host,
            isCoHost: coHost,
            muted: false,
            videoOn: true,
            handRaised: false,
            isSpeaking: false,
          },
        ]}
      />
    </main>
  );
}

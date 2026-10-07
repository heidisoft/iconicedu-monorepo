'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ZoomMoreControls } from './zoom-more-controls';
import { Captions } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { useMeetingPictureInPicture } from './use-meeting-picture-in-picture';
import {
  MeetingPictureInPictureControls,
  MeetingPipProviders,
} from './meeting-picture-in-picture-controls';

/** Synthetic call content for lifecycle tests; this component is never a production route. */
export function MeetingPipFixture() {
  const [connected, setConnected] = useState(true);
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [hand, setHand] = useState(false);
  const [captions, setCaptions] = useState(false);
  const [content, setContent] = useState('video');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [settings, setSettings] = useState(false);
  const [more, setMore] = useState(false);
  const pip = useMeetingPictureInPicture({
    connected,
    sharing,
    cameraActive: camera,
    microphoneActive: !muted,
  });
  if (!pip.host) return null;
  return createPortal(
    <MeetingPipProviders container={pip.pipWindow?.document.body}>
      <MeetingPictureInPictureControls
        pip={pip}
        settingsOpen={settings}
        onSettingsOpenChange={setSettings}
      />
      <section className="zoom-meeting-shell fixed inset-0 flex flex-col gap-3 overflow-auto bg-background p-4 text-foreground">
        <h1>Picture-in-picture test call</h1>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void pip.open()}>Open picture-in-picture</Button>
          <Button onClick={() => setSettings(true)}>Floating call preferences</Button>
          <Button onClick={() => setMuted(!muted)}>
            {muted ? 'Unmute microphone' : 'Mute microphone'}
          </Button>
          <Button onClick={() => setCamera(!camera)}>
            {camera ? 'Stop camera' : 'Start camera'}
          </Button>
          <Button onClick={() => setHand(!hand)}>
            {hand ? 'Lower hand' : 'Raise hand'}
          </Button>
          <Button onClick={() => setCaptions(!captions)}>
            {captions ? 'Turn off captions' : 'Turn on captions'}
          </Button>
          <Button onClick={() => setSharing(!sharing)}>
            {sharing ? 'Stop sharing' : 'Start sharing'}
          </Button>
          <Button
            onClick={() => setContent(content === 'whiteboard' ? 'video' : 'whiteboard')}
          >
            Toggle whiteboard
          </Button>
          <Button onClick={() => setConnected(false)}>Leave call</Button>
        </div>
        <ZoomMoreControls
          open={more}
          onOpenChange={setMore}
          actions={[
            {
              id: 'test-captions',
              label: 'Toggle test captions',
              icon: <Captions />,
              onSelect: () => setCaptions(!captions),
            },
          ]}
        />
        <div role="status">
          {connected ? 'Connected' : 'Call ended'} · {content}
          {sharing ? ' · Sharing' : ''}
        </div>
        <canvas
          data-testid="live-call-canvas"
          width="320"
          height="180"
          className="h-32 w-full rounded-md border border-border"
        />
        <label>
          Whiteboard text
          <input
            aria-label="Whiteboard text"
            className="border border-border bg-background"
          />
        </label>
        <label>
          Chat message
          <input
            aria-label="Chat message"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="border border-border bg-background"
          />
        </label>
        <Button
          onClick={() => {
            if (draft.trim()) setMessages([...messages, draft]);
            setDraft('');
          }}
        >
          Send message
        </Button>
        {messages.map((message, index) => (
          <p key={index}>{message}</p>
        ))}
      </section>
    </MeetingPipProviders>,
    pip.host,
  );
}

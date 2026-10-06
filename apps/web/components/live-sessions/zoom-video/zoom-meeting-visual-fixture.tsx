'use client';

import { useRef, useState } from 'react';
import {
  Hand,
  MessageSquare,
  Mic,
  MonitorUp,
  Pencil,
  PhoneOff,
  Settings,
  SmilePlus,
  Users,
  Video,
} from 'lucide-react';
import type { RecordingStatus } from '@zoom/videosdk';

import { TooltipProvider } from '@iconicedu/ui-web/ui/tooltip';
import { ZoomChatPanel } from './zoom-chat-panel';
import { MeetingControlButton } from './zoom-meeting-controls';
import { ZoomMeetingHeader } from './zoom-meeting-header';
import { ZoomMeetingLayoutStyles } from './zoom-meeting-layout-styles';
import { ZoomMeetingDockButton, ZoomMeetingSideDock } from './zoom-meeting-side-dock';
import { ZoomMeetingTimer } from './zoom-meeting-timer';
import { ZoomParticipantGallery } from './zoom-participant-gallery';
import { ZoomParticipantsPanel } from './zoom-participants-panel';
import { useMeetingRecordingControl } from './zoom-recording-control';
import { ZoomMoreControls } from './zoom-more-controls';
import { ZoomShareMeetingDialog } from './zoom-share-meeting-dialog';
import type { SidePanel } from './zoom-video-session.types';

const participants = [
  {
    userId: 2,
    displayName: 'Oyin Kansola',
    muted: true,
    bVideoOn: false,
    isHost: false,
  },
  {
    userId: 3,
    displayName: 'Matthew Chesky',
    muted: false,
    bVideoOn: false,
    isHost: false,
  },
  {
    userId: 4,
    displayName: 'Samantha Fox',
    muted: true,
    bVideoOn: false,
    isHost: false,
  },
];

export function ZoomMeetingVisualFixture({
  participantCount = 4,
}: {
  participantCount?: number;
}) {
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>(
    'Recording' as RecordingStatus,
  );
  const recordingStatusRef = useRef(recordingStatus);
  const selfVideoRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [activePanel, setActivePanel] = useState<SidePanel>(null);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [galleryPage, setGalleryPage] = useState(0);

  const recording = useMeetingRecordingControl({
    canManage: true,
    status: recordingStatus,
    onStatusChange: setRecordingStatus,
    client: {
      canStartRecording: () => true,
      startCloudRecording: async () => {
        recordingStatusRef.current = 'Recording' as RecordingStatus;
        return '';
      },
      stopCloudRecording: async () => {
        recordingStatusRef.current = 'Stopped' as RecordingStatus;
        return '';
      },
      getCloudRecordingStatus: () => recordingStatusRef.current,
    },
  });

  return (
    <TooltipProvider delayDuration={0}>
      <main className="zoom-meeting-shell fixed inset-0 overflow-hidden bg-background">
        <ZoomMeetingHeader
          title="Airbnb: Product Management Structure"
          participantCount={participantCount}
          recordingStatus={recordingStatus}
        />

        <ZoomParticipantGallery
          displayName="Olawale Adeyeye"
          selfMuted={false}
          selfVideoOn={false}
          selfHandRaised={false}
          selfVideoRef={selfVideoRef}
          remoteParticipants={participants.slice(0, participantCount - 1)}
          raisedHandUserIds={new Set([4])}
          activeSpeakerUserId={3}
          selfUserId={1}
          sidebarOpen={activePanel !== null}
          page={galleryPage}
          onPageChange={setGalleryPage}
          onRemoteContainer={() => undefined}
        />

        <div
          className="zoom-meeting-gutter-padding absolute inset-x-0 z-30 overflow-x-auto pb-1 sm:overflow-visible"
          style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <div
            className="zoom-toolbar relative mx-auto flex w-full items-center justify-center gap-1 sm:gap-1.5"
            role="toolbar"
            aria-label="Class controls"
            data-mobile-expanded={mobileExpanded}
          >
            <ZoomMeetingTimer elapsedSeconds={713} />
            <MeetingControlButton label="Mute microphone">
              <Mic />
            </MeetingControlButton>
            <MeetingControlButton label="Stop camera">
              <Video />
            </MeetingControlButton>
            <MeetingControlButton label="Share screen">
              <MonitorUp />
            </MeetingControlButton>

            <MeetingControlButton label="Start whiteboard">
              <Pencil />
            </MeetingControlButton>

            <ZoomShareMeetingDialog
              meetingTitle="Airbnb: Product Management Structure"
              meetingPasscode="demo-1234"
            />
            <ZoomMoreControls
              error={recording.error}
              open={mobileExpanded}
              onOpenChange={setMobileExpanded}
              actions={[
                ...(recording.action ? [recording.action] : []),
                {
                  id: 'participants',
                  label: 'Participants (4)',
                  icon: <Users />,
                  mobileOnly: true,
                  onSelect: () => setActivePanel('users'),
                },
                {
                  id: 'messages',
                  label: 'Messages (2 unread)',
                  icon: <MessageSquare />,
                  mobileOnly: true,
                  onSelect: () => setActivePanel('chat'),
                },
                {
                  id: 'settings',
                  label: 'Audio and video settings',
                  icon: <Settings />,
                  onSelect: () => undefined,
                },
              ]}
            />

            <ZoomMeetingSideDock>
              <ZoomMeetingDockButton
                label="Raise hand"
                active={false}
                className="size-12 px-0 shadow-md ring-1 ring-border/70"
              >
                <Hand className="size-5" />
              </ZoomMeetingDockButton>
              <ZoomMeetingDockButton
                label="Open reactions"
                active={false}
                className="size-12 px-0 shadow-md ring-1 ring-border/70"
              >
                <SmilePlus className="size-5" />
              </ZoomMeetingDockButton>
              <ZoomParticipantsPanel
                open={activePanel === 'users'}
                canMuteOthers
                className="zoom-toolbar-people zoom-toolbar-secondary"
                participants={[
                  {
                    userId: 1,
                    name: 'Olawale Adeyeye',
                    isYou: true,
                    isHost: true,
                    muted: false,
                    videoOn: false,
                    handRaised: false,
                    isSpeaking: false,
                  },
                  ...participants.map((participant) => ({
                    userId: participant.userId,
                    name: participant.displayName,
                    isYou: false,
                    isHost: participant.isHost,
                    muted: participant.muted,
                    videoOn: participant.bVideoOn,
                    handRaised: participant.userId === 4,
                    isSpeaking: participant.userId === 3,
                  })),
                ]}
                onOpenChange={(open) => setActivePanel(open ? 'users' : null)}
                onMute={() => undefined}
              />
              <ZoomChatPanel
                open={activePanel === 'chat'}
                unreadCount={2}
                messages={[
                  {
                    id: 'fixture-message',
                    senderUserId: 2,
                    senderName: 'Oyin Kansola',
                    message: 'Can everyone see the shared screen?',
                    timestamp: Date.UTC(2026, 9, 4, 12, 0, 0),
                  },
                ]}
                draft=""
                selfUserId={1}
                scrollRef={chatScrollRef}
                className="zoom-toolbar-chat zoom-toolbar-secondary"
                onOpenChange={(open) => setActivePanel(open ? 'chat' : null)}
                onDraftChange={() => undefined}
                onSend={() => undefined}
              />
            </ZoomMeetingSideDock>

            <MeetingControlButton
              label="Leave class"
              tone="danger"
              className="zoom-toolbar-leave sticky right-0 z-10"
            >
              <PhoneOff />
            </MeetingControlButton>
          </div>
        </div>

        <ZoomMeetingLayoutStyles />
      </main>
    </TooltipProvider>
  );
}

'use client';

import {
  ChevronDown,
  Hand,
  Info,
  MessageCircle,
  Mic,
  MicOff,
  MonitorUp,
  MoreVertical,
  Phone,
  Settings,
  Users,
  Video,
  VideoOff,
} from 'lucide-react';

import { Button } from '@iconicedu/ui-web/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@iconicedu/ui-web/ui/dropdown-menu';
import {
  ViewSwitcher,
  type LiveSessionViewType,
} from '@iconicedu/web/components/live-sessions/view-switcher';

interface ControlBarProps {
  microphoneOptions?: Array<{ id: string; label: string }>;
  cameraOptions?: Array<{ id: string; label: string }>;
  currentMicrophoneId?: string | null;
  currentCameraId?: string | null;
  meetingName: string;
  isMuted: boolean;
  isVideoOn: boolean;
  isSharing: boolean;
  isDirectCall?: boolean;
  isEnding?: boolean;
  isParticipantsOpen?: boolean;
  isHandRaised?: boolean;
  currentView?: LiveSessionViewType;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleShare: () => void;
  onToggleParticipants: () => void;
  onToggleSettings: () => void;
  onToggleRaiseHand: () => void;
  onEndCall: () => void;
  onSelectMicrophone?: (id: string) => void;
  onSelectCamera?: (id: string) => void;
  onViewChange?: (view: LiveSessionViewType) => void;
}

export function ControlBar({
  microphoneOptions = [],
  cameraOptions = [],
  currentMicrophoneId,
  currentCameraId,
  meetingName,
  isMuted,
  isVideoOn,
  isSharing,
  isDirectCall = false,
  isEnding = false,
  isParticipantsOpen = false,
  isHandRaised = false,
  currentView,
  onToggleMute,
  onToggleVideo,
  onToggleShare,
  onToggleParticipants,
  onToggleSettings,
  onToggleRaiseHand,
  onEndCall,
  onSelectMicrophone,
  onSelectCamera,
  onViewChange,
}: ControlBarProps) {
  return (
    <div className="border-t border-border bg-card text-card-foreground">
      <div className="flex h-20 items-center justify-between px-6 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <p className="truncate text-sm font-medium text-foreground">{meetingName}</p>
          {!isDirectCall && currentView && onViewChange ? (
            <ViewSwitcher currentView={currentView} onViewChange={onViewChange} />
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center overflow-hidden rounded-full bg-muted">
            {onSelectMicrophone && microphoneOptions.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-8 rounded-none rounded-l-full"
                    title="Change microphone"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-64">
                  {microphoneOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.id}
                      onClick={() => onSelectMicrophone(option.id)}
                      className={currentMicrophoneId === option.id ? 'bg-primary/10 text-primary' : ''}
                    >
                      <Mic className="mr-2 h-4 w-4" />
                      <span className="truncate">{option.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            <Button
              size="icon"
              variant={isMuted ? 'destructive' : 'ghost'}
              onClick={onToggleMute}
              className={[
                'h-10 w-10 rounded-none',
                onSelectMicrophone && microphoneOptions.length > 0 ? 'rounded-r-full' : 'rounded-full',
              ].join(' ')}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
          </div>

          {!isDirectCall ? (
            <div className="flex items-center overflow-hidden rounded-full bg-muted">
              {onSelectCamera && cameraOptions.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-10 w-8 rounded-none rounded-l-full"
                      title="Change camera"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-64">
                    {cameraOptions.map((option) => (
                      <DropdownMenuItem
                        key={option.id}
                        onClick={() => onSelectCamera(option.id)}
                        className={currentCameraId === option.id ? 'bg-primary/10 text-primary' : ''}
                      >
                        <Video className="mr-2 h-4 w-4" />
                        <span className="truncate">{option.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}

              <Button
                size="icon"
                variant={isVideoOn ? 'ghost' : 'destructive'}
                onClick={onToggleVideo}
                className={[
                  'h-10 w-10 rounded-none',
                  onSelectCamera && cameraOptions.length > 0 ? 'rounded-r-full' : 'rounded-full',
                ].join(' ')}
                title={isVideoOn ? 'Stop video' : 'Start video'}
              >
                {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>
            </div>
          ) : null}

          {!isDirectCall ? (
            <Button
              size="icon"
              variant={isSharing ? 'default' : 'ghost'}
              onClick={onToggleShare}
              className="h-10 w-10 rounded-full"
              title={isSharing ? 'Stop sharing' : 'Share screen'}
            >
              <MonitorUp className="h-5 w-5" />
            </Button>
          ) : null}

          <Button
            size="icon"
            variant={isHandRaised ? 'secondary' : 'ghost'}
            onClick={onToggleRaiseHand}
            className="h-10 w-10 rounded-full"
            title={isHandRaised ? 'Lower hand' : 'Raise hand'}
          >
            <Hand className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-full"
                title="More options"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56">
              <DropdownMenuItem onClick={onToggleSettings}>
                <Settings className="mr-2 h-4 w-4" />
                Open settings
              </DropdownMenuItem>
              <DropdownMenuItem>Record meeting</DropdownMenuItem>
              <DropdownMenuItem>Schedule something</DropdownMenuItem>
              <DropdownMenuItem>Blur background</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="icon"
            variant="destructive"
            className="h-10 w-10 rounded-full"
            onClick={onEndCall}
            title={isDirectCall ? 'Hang up' : 'End call'}
          >
            {isEnding ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Phone className="h-5 w-5 rotate-[135deg]" />
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {!isDirectCall ? (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-full text-muted-foreground"
                title="Info"
              >
                <Info className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                variant={isParticipantsOpen ? 'secondary' : 'ghost'}
                className="h-10 w-10 rounded-full text-muted-foreground"
                title="People"
                onClick={onToggleParticipants}
              >
                <Users className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-full text-muted-foreground"
                title="Chat"
              >
                <MessageCircle className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-full text-muted-foreground"
                title="Settings"
                onClick={onToggleSettings}
              >
                <Settings className="h-5 w-5" />
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

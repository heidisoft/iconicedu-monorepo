'use client';

import {
  Info,
  MessageCircle,
  Mic,
  MicOff,
  MoreVertical,
  Phone,
  Settings,
  Share2,
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

interface ControlBarProps {
  meetingName: string;
  isMuted: boolean;
  isVideoOn: boolean;
  isSharing: boolean;
  isDirectCall?: boolean;
  isEnding?: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleShare: () => void;
  onToggleSettings: () => void;
  onEndCall: () => void;
}

export function ControlBar({
  meetingName,
  isMuted,
  isVideoOn,
  isSharing,
  isDirectCall = false,
  isEnding = false,
  onToggleMute,
  onToggleVideo,
  onToggleShare,
  onToggleSettings,
  onEndCall,
}: ControlBarProps) {
  return (
    <div className="mt-4 rounded-[24px] bg-[#151821] px-3 py-2 text-white dark:bg-[#12161d]">
      <div className="flex h-20 items-center justify-between gap-4">
        <div className="min-w-0 flex-1 pl-2">
          <p className="truncate text-lg font-medium text-white">{meetingName}</p>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-black/25 px-2 py-1.5">
          <Button
            size="icon-lg"
            variant={isMuted ? 'outline' : 'secondary'}
            onClick={onToggleMute}
            className="h-12 w-12 rounded-full border-white/10 bg-white/10 text-white hover:bg-white/15"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>

          {!isDirectCall ? (
            <Button
              size="icon-lg"
              variant={isVideoOn ? 'secondary' : 'outline'}
              onClick={onToggleVideo}
              className="h-12 w-12 rounded-full border-white/10 bg-white/10 text-white hover:bg-white/15"
              title={isVideoOn ? 'Stop video' : 'Start video'}
            >
              {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
          ) : null}

          {!isDirectCall ? (
            <Button
              size="icon-lg"
              variant={isSharing ? 'default' : 'outline'}
              onClick={onToggleShare}
              className={[
                'h-12 w-12 rounded-full border-white/10 text-white',
                isSharing
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-white/10 hover:bg-white/15',
              ].join(' ')}
              title={isSharing ? 'Stop sharing' : 'Share screen'}
            >
              <Share2 className="h-5 w-5" />
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-lg"
                variant="outline"
                className="h-12 w-12 rounded-full border-white/10 bg-white/10 text-white hover:bg-white/15"
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
            size="icon-lg"
            className="ml-1 h-12 w-14 rounded-full bg-red-600 text-white hover:bg-red-700"
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

        <div className="flex flex-1 items-center justify-end gap-2 pr-2">
          {!isDirectCall ? (
            <>
              <Button
                size="icon-lg"
                variant="ghost"
                className="h-11 w-11 rounded-full text-white hover:bg-white/10"
                title="Info"
              >
                <Info className="h-5 w-5" />
              </Button>
              <Button
                size="icon-lg"
                variant="ghost"
                className="h-11 w-11 rounded-full text-white hover:bg-white/10"
                title="People"
              >
                <Users className="h-5 w-5" />
              </Button>
              <Button
                size="icon-lg"
                variant="ghost"
                className="h-11 w-11 rounded-full text-white hover:bg-white/10"
                title="Chat"
              >
                <MessageCircle className="h-5 w-5" />
              </Button>
              <Button
                size="icon-lg"
                variant="ghost"
                className="h-11 w-11 rounded-full text-white hover:bg-white/10"
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

'use client';

import * as React from 'react';
import type { MessageMentionVM, UserProfileVM } from '@iconicedu/shared-types';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../ui/tooltip';
import { EmojiPicker } from './emoji-picker';
import {
  cn,
} from '../../lib/utils';
import {
  getMentionCandidates,
  getMentionPopupPosition,
  getMentionState,
  matchesMentionQuery,
  type MentionCandidate,
  type MentionPopupPosition,
  type MentionState,
} from './message-input.utils';
import { extractMentionsFromMessageText } from './message-mentions.utils';
import { applyInlineFormat } from './message-input-formatting.utils';
import {
  Bold,
  Italic,
  AtSign,
  Smile,
  Paperclip,
  Send,
  Loader2,
  ImageIcon,
  Mic,
  Pause,
  Play,
  Check,
  X,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import {
  buildRecordedAudioFileName,
  formatRecordingDuration,
  formatComposerAttachmentSize,
  getDroppedAttachmentFiles,
  getRecordingElapsedMs,
  getComposerAttachmentKind,
  splitComposerAttachmentsByKind,
  getSupportedAudioRecordingMimeType,
  MESSAGE_INPUT_FILE_ACCEPT,
  MESSAGE_INPUT_IMAGE_ACCEPT,
  resolveAudioDurationSeconds,
  SHORT_AUDIO_RECORDING_MAX_MS,
  type ComposerAttachmentKind,
  type ComposerRecordingStatus,
} from './message-input.attachments';
import {
  extractComposerLinkPreviewUrl,
  shouldShowComposerLinkPreview,
} from './message-input-link-preview.utils';
import { LinkPreviewCard } from './link-preview-card';

const TYPING_STOP_DELAY_MS = 3000;
const TYPING_KEEPALIVE_THROTTLE_MS = 1200;

interface MessageInputProps {
  onSend: (content: string, mentions?: MessageMentionVM[]) => void;
  onAttachFiles?: (
    attachments: Array<{ file: File; durationSeconds?: number }>,
    content?: string,
  ) => Promise<void> | void;
  placeholder?: string;
  sticky?: boolean;
  readOnly?: boolean;
  participants?: UserProfileVM[];
  currentUserId?: string | null;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  onFocus?: () => void;
  onInputKeyDown?: () => void;
  isLoading?: boolean;
}

type PendingAttachment = {
  id: string;
  file: File;
  kind: ComposerAttachmentKind;
  previewUrl?: string;
  durationSeconds?: number;
};

type RecordingSession = {
  status: ComposerRecordingStatus;
  startedAt: number;
  accumulatedMs: number;
};

type ComposerLinkPreview = {
  url: string;
  title: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  favicon?: string;
};

function FormatButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          aria-label={label}
          title={label}
          onClick={onClick}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function MessageInput({
  onSend,
  onAttachFiles,
  placeholder = 'Write a message...',
  sticky = true,
  readOnly = false,
  participants = [],
  currentUserId,
  onTypingStart,
  onTypingStop,
  onFocus,
  onInputKeyDown,
  isLoading = false,
}: MessageInputProps) {
  const [content, setContent] = React.useState('');
  const [isAttachingFile, setIsAttachingFile] = React.useState(false);
  const [pendingAttachments, setPendingAttachments] = React.useState<PendingAttachment[]>([]);
  const [attachmentError, setAttachmentError] = React.useState<string | null>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [linkPreview, setLinkPreview] = React.useState<ComposerLinkPreview | null>(null);
  const [isLoadingLinkPreview, setIsLoadingLinkPreview] = React.useState(false);
  const [dismissedLinkPreviewUrl, setDismissedLinkPreviewUrl] = React.useState<string | null>(null);
  const [recordingSession, setRecordingSession] = React.useState<RecordingSession | null>(null);
  const [recordingElapsedMs, setRecordingElapsedMs] = React.useState(0);
  const [mentionState, setMentionState] = React.useState<MentionState | null>(null);
  const [mentionPopupPosition, setMentionPopupPosition] =
    React.useState<MentionPopupPosition | null>(null);
  const [activeMentionIndex, setActiveMentionIndex] = React.useState(0);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const dragDepthRef = React.useRef(0);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const typingTimeoutRef = React.useRef<number | null>(null);
  const recordingTimeoutRef = React.useRef<number | null>(null);
  const recordingIntervalRef = React.useRef<number | null>(null);
  const isTypingRef = React.useRef(false);
  const lastTypingSignalAtRef = React.useRef<number>(0);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const recordingChunksRef = React.useRef<Blob[]>([]);
  const recordingSessionRef = React.useRef<RecordingSession | null>(null);
  const recordingStopModeRef = React.useRef<'complete' | 'cancel'>('complete');
  const mentionCandidates = React.useMemo(
    () => getMentionCandidates(participants, currentUserId),
    [participants, currentUserId],
  );
  const filteredMentionCandidates = React.useMemo(() => {
    if (!mentionState) return [];
    return mentionCandidates.filter((candidate) =>
      matchesMentionQuery(candidate, mentionState.query),
    );
  }, [mentionCandidates, mentionState]);
  const isMentionListOpen = mentionState !== null && filteredMentionCandidates.length > 0;
  const isBusy = isLoading || isAttachingFile;
  const isRecordingAudio = recordingSession?.status === 'recording';
  const isRecordingPaused = recordingSession?.status === 'paused';
  const hasActiveRecording = recordingSession !== null;
  const pendingAttachmentPreviewGroups = React.useMemo(
    () => splitComposerAttachmentsByKind(pendingAttachments),
    [pendingAttachments],
  );
  const composerPreviewUrl = React.useMemo(
    () =>
      pendingAttachments.length === 0 && !hasActiveRecording
        ? extractComposerLinkPreviewUrl(content)
        : null,
    [content, hasActiveRecording, pendingAttachments.length],
  );
  const visibleComposerPreviewUrl = React.useMemo(
    () =>
      shouldShowComposerLinkPreview(composerPreviewUrl, dismissedLinkPreviewUrl)
        ? composerPreviewUrl
        : null,
    [composerPreviewUrl, dismissedLinkPreviewUrl],
  );

  const stopRecordingStream = React.useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const clearRecordingTimeout = React.useCallback(() => {
    if (recordingTimeoutRef.current) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  }, []);

  const clearRecordingInterval = React.useCallback(() => {
    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, []);

  const syncRecordingSession = React.useCallback((nextSession: RecordingSession | null) => {
    recordingSessionRef.current = nextSession;
    setRecordingSession(nextSession);
    setRecordingElapsedMs(nextSession ? getRecordingElapsedMs(nextSession) : 0);
  }, []);

  const startRecordingInterval = React.useCallback(() => {
    clearRecordingInterval();
    recordingIntervalRef.current = window.setInterval(() => {
      const currentSession = recordingSessionRef.current;
      if (!currentSession) {
        setRecordingElapsedMs(0);
        return;
      }
      setRecordingElapsedMs(getRecordingElapsedMs(currentSession));
    }, 250);
  }, [clearRecordingInterval]);

  const clearPendingAttachments = React.useCallback(() => {
    setPendingAttachments((current) => {
      current.forEach((attachment) => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
      return [];
    });
  }, []);

  const removePendingAttachment = React.useCallback((attachmentId: string) => {
    setPendingAttachments((current) =>
      current.filter((attachment) => {
        if (attachment.id === attachmentId && attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
        return attachment.id !== attachmentId;
      }),
    );
  }, []);

  const resetRecordingState = React.useCallback(() => {
    clearRecordingTimeout();
    clearRecordingInterval();
    mediaRecorderRef.current = null;
    syncRecordingSession(null);
  }, [clearRecordingInterval, clearRecordingTimeout, syncRecordingSession]);

  const setPendingComposerAttachment = React.useCallback(
    (files: File[], durationSeconds?: number) => {
      if (!files.length) {
        return;
      }
      const timestamp = Date.now();
      setPendingAttachments((current) => [
        ...current,
        ...files.map((file, index) => {
          const kind = getComposerAttachmentKind(file);
          const previewUrl =
            kind === 'image' || kind === 'audio' ? URL.createObjectURL(file) : undefined;
          return {
            id: `${timestamp}-${index}-${file.name}-${file.size}`,
            file,
            kind,
            previewUrl,
            durationSeconds,
          };
        }),
      ]);
      setAttachmentError(null);
    },
    [],
  );

  const updateMentionPopupPosition = React.useCallback(
    (caretPosition: number | null) => {
      setMentionPopupPosition(
        getMentionPopupPosition(wrapperRef.current, textareaRef.current, caretPosition),
      );
    },
    [],
  );

  const clearTypingTimeout = React.useCallback(() => {
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, []);

  const notifyTypingStop = React.useCallback(() => {
    if (!isTypingRef.current) return;
    isTypingRef.current = false;
    onTypingStop?.();
  }, [onTypingStop]);

  const handleTyping = React.useCallback(
    (value: string) => {
      if (readOnly) {
        return;
      }
      if (!value.trim()) {
        clearTypingTimeout();
        notifyTypingStop();
        return;
      }
      const now = Date.now();
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        lastTypingSignalAtRef.current = now;
        onTypingStart?.();
      } else if (now - lastTypingSignalAtRef.current >= TYPING_KEEPALIVE_THROTTLE_MS) {
        lastTypingSignalAtRef.current = now;
        onTypingStart?.();
      }
      clearTypingTimeout();
      typingTimeoutRef.current = window.setTimeout(() => {
        notifyTypingStop();
      }, TYPING_STOP_DELAY_MS);
    },
    [clearTypingTimeout, notifyTypingStop, onTypingStart, readOnly],
  );

  const syncMentionState = React.useCallback((value: string, caretPosition: number | null) => {
    const nextMentionState = getMentionState(value, caretPosition);
    setMentionState(nextMentionState);
    setActiveMentionIndex(0);
    setMentionPopupPosition(
      getMentionPopupPosition(wrapperRef.current, textareaRef.current, nextMentionState?.end ?? null),
    );
  }, []);

  const insertAtCursor = React.useCallback(
    (text: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextValue = content.slice(0, start) + text + content.slice(end);

      setContent(nextValue);
      handleTyping(nextValue);
      window.setTimeout(() => {
        textarea.focus();
        const nextCaret = start + text.length;
        textarea.setSelectionRange(nextCaret, nextCaret);
        syncMentionState(nextValue, nextCaret);
        updateMentionPopupPosition(nextCaret);
      }, 0);
    },
    [content, handleTyping, syncMentionState, updateMentionPopupPosition],
  );

  const applyFormatAtSelection = React.useCallback(
    (wrapper: string) => {
      const textarea = textareaRef.current;
      if (!textarea || readOnly || isBusy || hasActiveRecording) {
        return;
      }

      const result = applyInlineFormat(
        content,
        textarea.selectionStart,
        textarea.selectionEnd,
        wrapper,
      );

      setContent(result.nextValue);
      handleTyping(result.nextValue);

      window.setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
        syncMentionState(result.nextValue, result.selectionEnd);
      }, 0);
    },
    [content, handleTyping, hasActiveRecording, isBusy, readOnly, syncMentionState],
  );

  const handleMentionSelect = React.useCallback(
    (candidate: MentionCandidate) => {
      const textarea = textareaRef.current;
      if (!textarea || !mentionState) return;

      const mentionText = `@${candidate.displayName} `;
      const nextValue =
        content.slice(0, mentionState.start) +
        mentionText +
        content.slice(mentionState.end);
      const nextCaret = mentionState.start + mentionText.length;

      setContent(nextValue);
      handleTyping(nextValue);
      setMentionState(null);
      setActiveMentionIndex(0);

      window.setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(nextCaret, nextCaret);
        updateMentionPopupPosition(nextCaret);
      }, 0);
    },
    [content, handleTyping, mentionState, updateMentionPopupPosition],
  );

  const resetComposer = React.useCallback(() => {
    setContent('');
    clearPendingAttachments();
    setAttachmentError(null);
    setMentionState(null);
    setMentionPopupPosition(null);
    setActiveMentionIndex(0);
    clearTypingTimeout();
    notifyTypingStop();
    textareaRef.current?.focus();
  }, [clearPendingAttachments, clearTypingTimeout, notifyTypingStop]);

  const handleSend = React.useCallback(() => {
    if (readOnly || isBusy || hasActiveRecording) {
      return;
    }
    const trimmedContent = content.trim();
    if (!trimmedContent && pendingAttachments.length === 0) {
      return;
    }

    if (pendingAttachments.length > 0 && onAttachFiles) {
      const sendAttachment = async () => {
        try {
          setIsAttachingFile(true);
          await onAttachFiles(
            await Promise.all(
              pendingAttachments.map(async (pendingAttachment) => ({
                file: pendingAttachment.file,
                durationSeconds:
                  pendingAttachment.kind === 'audio'
                    ? await resolveAudioDurationSeconds(
                        pendingAttachment.file,
                        pendingAttachment.durationSeconds,
                      )
                    : undefined,
              })),
            ),
            trimmedContent || undefined,
          );
          resetComposer();
        } finally {
          setIsAttachingFile(false);
        }
      };
      void sendAttachment();
      return;
    }

    if (trimmedContent) {
      const mentions = extractMentionsFromMessageText(
        trimmedContent,
        participants,
        currentUserId,
      );
    onSend(trimmedContent, mentions);
      resetComposer();
    }
  }, [
    content,
    currentUserId,
    hasActiveRecording,
    isBusy,
    onAttachFiles,
    onSend,
    pendingAttachments,
    participants,
    readOnly,
    resetComposer,
  ]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (readOnly || isBusy) {
        return;
      }
      onInputKeyDown?.();
      if (isMentionListOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveMentionIndex((index) =>
            filteredMentionCandidates.length === 0
              ? 0
              : (index + 1) % filteredMentionCandidates.length,
          );
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveMentionIndex((index) =>
            filteredMentionCandidates.length === 0
              ? 0
              : (index - 1 + filteredMentionCandidates.length) %
                filteredMentionCandidates.length,
          );
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const candidate = filteredMentionCandidates[activeMentionIndex];
          if (candidate) {
            handleMentionSelect(candidate);
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setMentionState(null);
          setActiveMentionIndex(0);
          return;
        }
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [
      activeMentionIndex,
      filteredMentionCandidates,
      handleMentionSelect,
      handleSend,
      isBusy,
      isMentionListOpen,
      onInputKeyDown,
      readOnly,
    ],
  );

  const handleEmojiSelect = React.useCallback(
    (emoji: string) => {
      insertAtCursor(emoji);
    },
    [insertAtCursor],
  );

  React.useEffect(() => {
    return () => {
      clearTypingTimeout();
      clearRecordingTimeout();
      clearRecordingInterval();
      stopRecordingStream();
      notifyTypingStop();
    };
  }, [clearRecordingInterval, clearRecordingTimeout, clearTypingTimeout, notifyTypingStop, stopRecordingStream]);

  React.useEffect(() => {
    if (!isMentionListOpen) {
      setMentionPopupPosition(null);
      return;
    }

    updateMentionPopupPosition(mentionState?.end ?? textareaRef.current?.selectionStart ?? null);

    const handleViewportChange = () => {
      updateMentionPopupPosition(mentionState?.end ?? textareaRef.current?.selectionStart ?? null);
    };

    window.addEventListener('resize', handleViewportChange);
    const textarea = textareaRef.current;
    textarea?.addEventListener('scroll', handleViewportChange);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      textarea?.removeEventListener('scroll', handleViewportChange);
    };
  }, [isMentionListOpen, mentionState?.end, updateMentionPopupPosition]);

  React.useEffect(() => {
    if (!composerPreviewUrl) {
      setDismissedLinkPreviewUrl(null);
    } else if (
      dismissedLinkPreviewUrl &&
      dismissedLinkPreviewUrl !== composerPreviewUrl
    ) {
      setDismissedLinkPreviewUrl(null);
    }
  }, [composerPreviewUrl, dismissedLinkPreviewUrl]);

  React.useEffect(() => {
    if (!visibleComposerPreviewUrl) {
      setLinkPreview(null);
      setIsLoadingLinkPreview(false);
      return;
    }

    const controller = new AbortController();
    setIsLoadingLinkPreview(true);

    const loadPreview = async () => {
      try {
      const response = await fetch(
        `/api/messages/link-preview?url=${encodeURIComponent(visibleComposerPreviewUrl)}`,
        { signal: controller.signal },
      );
        if (!response.ok) {
          throw new Error('Unable to load link preview');
        }
        const payload = (await response.json()) as {
          success: boolean;
          data?: ComposerLinkPreview;
        };
        if (!controller.signal.aborted) {
          setLinkPreview(payload.data ?? null);
        }
      } catch {
        if (!controller.signal.aborted) {
          setLinkPreview(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingLinkPreview(false);
        }
      }
    };

    void loadPreview();

  return () => {
      controller.abort();
    };
  }, [visibleComposerPreviewUrl]);

  const formatButtons = [
    { icon: Bold, label: 'Bold', onClick: () => applyFormatAtSelection('**') },
    { icon: Italic, label: 'Italic', onClick: () => applyFormatAtSelection('*') },
  ];

  const handleAttachButtonClick = React.useCallback(() => {
    if (readOnly || isBusy || hasActiveRecording || !onAttachFiles) {
      return;
    }
    fileInputRef.current?.click();
  }, [hasActiveRecording, isBusy, onAttachFiles, readOnly]);

  const handleAttachImageClick = React.useCallback(() => {
    if (readOnly || isBusy || hasActiveRecording || !onAttachFiles) {
      return;
    }
    imageInputRef.current?.click();
  }, [hasActiveRecording, isBusy, onAttachFiles, readOnly]);

  const handleFileInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? []);
      event.target.value = '';
      if (!selectedFiles.length || readOnly || isBusy || hasActiveRecording || !onAttachFiles) {
        return;
      }
      setPendingComposerAttachment(selectedFiles);
    },
    [hasActiveRecording, isBusy, onAttachFiles, readOnly, setPendingComposerAttachment],
  );

  const handleDropAttachment = React.useCallback(
    (files: File[]) => {
      if (!files.length || readOnly || isBusy || hasActiveRecording || !onAttachFiles) {
        return;
      }
      setPendingComposerAttachment(files);
    },
    [hasActiveRecording, isBusy, onAttachFiles, readOnly, setPendingComposerAttachment],
  );

  const handleStartAudioRecording = React.useCallback(async () => {
    if (readOnly || isBusy || hasActiveRecording || !onAttachFiles) {
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setAttachmentError('Audio recording is not supported in this browser.');
      return;
    }

    try {
      clearPendingAttachments();
      setAttachmentError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordingChunksRef.current = [];
      const mimeType = getSupportedAudioRecordingMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const initialSession: RecordingSession = {
        status: 'recording',
        startedAt: Date.now(),
        accumulatedMs: 0,
      };
      recordingStopModeRef.current = 'complete';
      syncRecordingSession(initialSession);
      startRecordingInterval();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const recordedChunks = [...recordingChunksRef.current];
        const finalSession = recordingSessionRef.current;
        const finalElapsedMs = finalSession ? getRecordingElapsedMs(finalSession) : 0;
        const stopMode = recordingStopModeRef.current;
        resetRecordingState();
        stopRecordingStream();
        recordingChunksRef.current = [];

        if (stopMode === 'cancel') {
          return;
        }

        const blob = new Blob(recordedChunks, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (!blob.size) {
          setAttachmentError('Unable to record audio.');
          return;
        }

        const durationSeconds = Math.max(1, Math.round(finalElapsedMs / 1000));
        const file = new File(
          [blob],
          buildRecordedAudioFileName(Date.now(), blob.type),
          { type: blob.type || 'audio/webm' },
        );
        setPendingComposerAttachment([file], durationSeconds);
      };
      recorder.onerror = () => {
        resetRecordingState();
        stopRecordingStream();
        setAttachmentError('Unable to record audio.');
      };
      recorder.start();
      recordingTimeoutRef.current = window.setTimeout(() => {
        recordingStopModeRef.current = 'complete';
        recorder.stop();
      }, SHORT_AUDIO_RECORDING_MAX_MS);
    } catch {
      resetRecordingState();
      stopRecordingStream();
      setAttachmentError('Microphone permission was denied.');
    }
  }, [
    clearPendingAttachments,
    hasActiveRecording,
    isBusy,
    onAttachFiles,
    readOnly,
    resetRecordingState,
    setPendingComposerAttachment,
    startRecordingInterval,
    stopRecordingStream,
    syncRecordingSession,
  ]);

  const handlePauseAudioRecording = React.useCallback(() => {
    const recorder = mediaRecorderRef.current;
    const currentSession = recordingSessionRef.current;
    if (!recorder || !currentSession || currentSession.status !== 'recording') {
      return;
    }

    const nextSession: RecordingSession = {
      status: 'paused',
      startedAt: currentSession.startedAt,
      accumulatedMs: getRecordingElapsedMs(currentSession),
    };
    clearRecordingTimeout();
    clearRecordingInterval();
    syncRecordingSession(nextSession);
    recorder.pause();
  }, [clearRecordingInterval, clearRecordingTimeout, syncRecordingSession]);

  const handleResumeAudioRecording = React.useCallback(() => {
    const recorder = mediaRecorderRef.current;
    const currentSession = recordingSessionRef.current;
    if (!recorder || !currentSession || currentSession.status !== 'paused') {
      return;
    }

    const nextSession: RecordingSession = {
      status: 'recording',
      startedAt: Date.now(),
      accumulatedMs: currentSession.accumulatedMs,
    };
    syncRecordingSession(nextSession);
    startRecordingInterval();
    recorder.resume();
    const remainingMs = Math.max(
      0,
      SHORT_AUDIO_RECORDING_MAX_MS - nextSession.accumulatedMs,
    );
    recordingTimeoutRef.current = window.setTimeout(() => {
      recordingStopModeRef.current = 'complete';
      recorder.stop();
    }, remainingMs);
  }, [startRecordingInterval, syncRecordingSession]);

  const handleCompleteAudioRecording = React.useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      return;
    }
    recordingStopModeRef.current = 'complete';
    recorder.stop();
  }, []);

  const handleCancelAudioRecording = React.useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      resetRecordingState();
      stopRecordingStream();
      return;
    }
    recordingStopModeRef.current = 'cancel';
    recorder.stop();
  }, [resetRecordingState, stopRecordingStream]);

  return (
    <div
      className={
        sticky
          ? 'sticky bottom-0 z-10 w-full border-t border-border backdrop-blur p-4 rounded-xl'
          : 'w-full border-t border-border bg-card/95 backdrop-blur p-4'
      }
    >
      <div className="mx-auto w-full max-w-[960px]">
        <div
          ref={wrapperRef}
          className={cn(
            'relative rounded-xl border border-input bg-background focus-within:ring-1 focus-within:ring-ring',
            isDragOver && 'border-primary bg-primary/5 ring-1 ring-primary/30',
          )}
          onDragEnter={(event) => {
            if (readOnly || isBusy || hasActiveRecording || !onAttachFiles) {
              return;
            }
            if (getDroppedAttachmentFiles(event.dataTransfer).length === 0) {
              return;
            }
            dragDepthRef.current += 1;
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragOver={(event) => {
            if (readOnly || isBusy || hasActiveRecording || !onAttachFiles) {
              return;
            }
            if (getDroppedAttachmentFiles(event.dataTransfer).length === 0) {
              return;
            }
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            setIsDragOver(true);
          }}
          onDragLeave={() => {
            if (dragDepthRef.current > 0) {
              dragDepthRef.current -= 1;
            }
            if (dragDepthRef.current === 0) {
              setIsDragOver(false);
            }
          }}
          onDrop={(event) => {
            dragDepthRef.current = 0;
            setIsDragOver(false);
            const droppedFiles = getDroppedAttachmentFiles(event.dataTransfer);
            if (droppedFiles.length === 0) {
              return;
            }
            event.preventDefault();
            handleDropAttachment(droppedFiles);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={MESSAGE_INPUT_FILE_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleFileInputChange}
          />
          <input
            ref={imageInputRef}
            type="file"
            multiple
            accept={MESSAGE_INPUT_IMAGE_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleFileInputChange}
          />
          {recordingSession ? (
            <div className="border-b border-border px-3 py-3">
              <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <Mic className={cn('h-5 w-5', isRecordingAudio ? 'animate-pulse' : '')} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <span
                      className={cn(
                        'inline-block h-2.5 w-2.5 rounded-full',
                        isRecordingAudio ? 'bg-destructive animate-pulse' : 'bg-amber-500',
                      )}
                    />
                    {isRecordingAudio ? 'Recording voice message' : 'Recording paused'}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatRecordingDuration(recordingElapsedMs / 1000)} elapsed
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={isRecordingAudio ? handlePauseAudioRecording : handleResumeAudioRecording}
                    >
                      {isRecordingAudio ? (
                        <>
                          <Pause className="h-3.5 w-3.5" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" />
                          Resume
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={handleCompleteAudioRecording}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Complete
                    </Button>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Discard recording"
                  onClick={handleCancelAudioRecording}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : null}
          {pendingAttachments.length > 0 ? (
            <div className="border-b border-border px-3 py-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                {pendingAttachments.length} attachment{pendingAttachments.length === 1 ? '' : 's'} ready to send
              </div>
              <div className="space-y-3">
                {pendingAttachmentPreviewGroups.images.length > 0 ? (
                  <div
                    className={cn(
                      'grid gap-2',
                      pendingAttachmentPreviewGroups.images.length === 1
                        ? 'grid-cols-1 max-w-[220px]'
                        : 'grid-cols-2',
                    )}
                  >
                    {pendingAttachmentPreviewGroups.images.map((pendingAttachment) => (
                      <div
                        key={pendingAttachment.id}
                        className="group relative overflow-hidden rounded-xl border border-border bg-muted/30"
                      >
                        {pendingAttachment.previewUrl ? (
                          <img
                            src={pendingAttachment.previewUrl}
                            alt={pendingAttachment.file.name}
                            className={cn(
                              'w-full object-cover',
                              pendingAttachmentPreviewGroups.images.length === 1
                                ? 'max-h-[220px]'
                                : 'h-32',
                            )}
                          />
                        ) : (
                          <div className="flex h-32 items-center justify-center bg-primary/5 text-primary">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 via-background/55 to-transparent px-3 pb-2 pt-6">
                          <div className="truncate text-sm font-medium text-foreground">
                            {pendingAttachment.file.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {pendingAttachment.file.size
                              ? formatComposerAttachmentSize(pendingAttachment.file.size)
                              : 'Image ready to send'}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon-xs"
                          className="absolute right-2 top-2"
                          aria-label={`Remove ${pendingAttachment.file.name}`}
                          onClick={() => removePendingAttachment(pendingAttachment.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
                {pendingAttachmentPreviewGroups.others.map((pendingAttachment) => (
                  <div
                    key={pendingAttachment.id}
                    className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3"
                  >
                    {pendingAttachment.kind === 'image' && pendingAttachment.previewUrl ? (
                      <img
                        src={pendingAttachment.previewUrl}
                        alt={pendingAttachment.file.name}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    ) : pendingAttachment.kind === 'audio' && pendingAttachment.previewUrl ? (
                      <audio
                        src={pendingAttachment.previewUrl}
                        className="h-16 w-24 rounded-lg"
                        controls
                        preload="metadata"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {pendingAttachment.file.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {pendingAttachment.kind === 'audio'
                            ? 'Voice message ready to send'
                            : 'File ready to send'}
                        {pendingAttachment.durationSeconds
                          ? ` • ${Math.floor(pendingAttachment.durationSeconds / 60)}:${String(
                              pendingAttachment.durationSeconds % 60,
                            ).padStart(2, '0')}`
                          : ''}
                        {pendingAttachment.file.size
                          ? ` • ${formatComposerAttachmentSize(pendingAttachment.file.size)}`
                          : ''}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remove ${pendingAttachment.file.name}`}
                      onClick={() => removePendingAttachment(pendingAttachment.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {!pendingAttachments.length && (isLoadingLinkPreview || linkPreview) ? (
            <div className="border-b border-border px-3 py-3">
              {isLoadingLinkPreview ? (
                <div className="relative max-w-md">
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-3 pr-10 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading link preview...
                  </div>
                  {visibleComposerPreviewUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="absolute right-2 top-2"
                      aria-label="Dismiss link preview"
                      onClick={() => setDismissedLinkPreviewUrl(visibleComposerPreviewUrl)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              ) : linkPreview ? (
                <div className="relative max-w-md">
                  <LinkPreviewCard
                    url={linkPreview.url}
                    title={linkPreview.title}
                    description={linkPreview.description}
                    imageUrl={linkPreview.imageUrl}
                    siteName={linkPreview.siteName}
                    favicon={linkPreview.favicon}
                    className="max-w-none overflow-hidden rounded-xl border border-border bg-card transition-colors"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-xs"
                    className="absolute right-2 top-2"
                    aria-label="Dismiss link preview"
                    onClick={() => setDismissedLinkPreviewUrl(linkPreview.url)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          {attachmentError ? (
            <div className="border-b border-border px-3 py-2 text-xs text-destructive">
              {attachmentError}
            </div>
          ) : null}
          {isDragOver ? (
            <div className="border-b border-border px-3 py-2 text-xs font-medium text-primary">
              Drop file or image to attach
            </div>
          ) : null}
          <Textarea
            ref={textareaRef}
            rows={1}
            value={content}
            readOnly={readOnly || hasActiveRecording}
            onChange={(e) => {
              const nextValue = e.target.value;
              setContent(nextValue);
              handleTyping(nextValue);
              syncMentionState(nextValue, e.target.selectionStart);
            }}
            onClick={(e) => syncMentionState(e.currentTarget.value, e.currentTarget.selectionStart)}
            onKeyUp={(e) => syncMentionState(e.currentTarget.value, e.currentTarget.selectionStart)}
            onSelect={(e) => syncMentionState(e.currentTarget.value, e.currentTarget.selectionStart)}
            onKeyDown={handleKeyDown}
            onFocus={onFocus}
            placeholder={placeholder}
            className="min-h-[80px] max-h-[120px] resize-none border-0 bg-transparent px-3 py-2 text-base sm:text-sm focus-visible:ring-0 focus-visible:ring-offset-0 overflow-x-hidden placeholder:whitespace-nowrap placeholder:text-ellipsis"
          />
          {isMentionListOpen ? (
            <div
              role="listbox"
              aria-label="Mention suggestions"
              className="absolute z-20 max-h-56 w-max min-w-56 overflow-y-auto rounded-2xl border border-border bg-popover p-1 shadow-xl"
              style={{
                left: mentionPopupPosition?.left ?? 28,
                top: mentionPopupPosition?.top ?? 12,
                maxWidth: mentionPopupPosition?.maxWidth ?? undefined,
              }}
            >
              {filteredMentionCandidates.map((candidate, index) => {
                const isActive = index === activeMentionIndex;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={cn(
                      'flex min-w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors',
                      isActive ? 'bg-muted text-foreground' : 'text-foreground hover:bg-muted',
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleMentionSelect(candidate);
                    }}
                    onMouseEnter={() => setActiveMentionIndex(index)}
                  >
                    <Avatar size="sm">
                      <AvatarImage src={candidate.avatarUrl} alt={candidate.displayName} />
                      <AvatarFallback>
                        {candidate.displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{candidate.displayName}</div>
                      {candidate.email ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {candidate.email}
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-border px-2 py-1.5">
            <TooltipProvider>
              <div className="flex items-center gap-0.5">
                {formatButtons.map((btn) => (
                  <FormatButton key={btn.label} icon={btn.icon} label={btn.label} onClick={btn.onClick} />
                ))}
                <div className="mx-1 h-4 w-px bg-border" />
                <FormatButton
                  icon={AtSign}
                  label="Mention someone"
                  onClick={() => {
                    if (readOnly || isBusy || hasActiveRecording) return;
                    insertAtCursor('@');
                  }}
                />
                <EmojiPicker onEmojiSelect={handleEmojiSelect}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                </EmojiPicker>
                <FormatButton
                  icon={ImageIcon}
                  label="Attach image"
                  onClick={handleAttachImageClick}
                />
                <FormatButton
                  icon={Paperclip}
                  label="Attach file"
                  onClick={handleAttachButtonClick}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-7 w-7',
                        recordingSession
                          ? 'bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                      aria-label={
                        recordingSession
                          ? isRecordingAudio
                            ? 'Recording in progress'
                            : 'Recording paused'
                          : 'Record voice message'
                      }
                      title={
                        recordingSession
                          ? isRecordingAudio
                            ? 'Recording in progress'
                            : 'Recording paused'
                          : 'Record voice message'
                      }
                      onClick={() => {
                        if (!recordingSession) {
                          void handleStartAudioRecording();
                        }
                      }}
                      disabled={Boolean(recordingSession)}
                    >
                      <Mic className={cn('h-4 w-4', isRecordingAudio ? 'animate-pulse' : '')} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {recordingSession
                      ? isRecordingAudio
                        ? 'Recording in progress'
                        : 'Recording paused'
                      : 'Record voice message'}
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
            <Button
              type="button"
              size="sm"
              onClick={handleSend}
              disabled={readOnly || isBusy || hasActiveRecording || (!content.trim() && pendingAttachments.length === 0)}
              className="h-8 gap-1.5"
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {isAttachingFile ? 'Uploading...' : 'Sending...'}
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Send
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

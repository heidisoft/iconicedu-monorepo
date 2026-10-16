import type { NativePictureInPictureAdapter } from './native-picture-in-picture';
import type {
  LiveSessionJoinCredentialsVM,
  LiveSessionSettingsVM,
} from '@iconicedu/shared-types';
import { DEFAULT_LIVE_SESSION_SETTINGS } from '@iconicedu/shared-types';

export type NativeParticipant = {
  id: string;
  name: string;
  host: boolean;
  cohost: boolean;
  muted: boolean;
  video: boolean;
};
/** Mirrors web's share privilege: host only, one presenter, or simultaneous presenters. */
export type NativeShareMode = 'locked' | 'single' | 'multiple';
export type NativeLeaveReason =
  | 'self'
  | 'ended-by-host'
  | 'removed'
  | 'network'
  | 'unknown';
export type NativeRecordingStatus = 'stopped' | 'recording' | 'paused';
/** Traditional consent leaves the class on decline; individual consent stays unrecorded. */
export type NativeRecordingConsent = 'traditional' | 'individual';
export type NativeMeetingEvent =
  | { type: 'joined'; selfId: string; participants: NativeParticipant[] }
  | { type: 'participants'; participants: NativeParticipant[] }
  | { type: 'left'; reason: NativeLeaveReason }
  | { type: 'error'; message: string }
  | { type: 'share'; userId: string; active: boolean }
  | { type: 'recording'; status: NativeRecordingStatus }
  | { type: 'recording-consent'; consent: NativeRecordingConsent }
  | { type: 'chat-privilege'; allowed: boolean }
  | { type: 'permission'; device: 'camera' | 'microphone' }
  | { type: 'audio-interrupted'; active: boolean }
  | ({ type: 'chat' } & NativeChatMessage)
  | { type: 'connection'; reconnecting: boolean }
  | { type: 'hand'; userId: string; raised: boolean }
  | { type: 'reaction'; userId: string; emoji: string }
  | { type: 'caption'; text: string }
  | { type: 'composition'; userId: string; active: boolean }
  | { type: 'speaking'; userIds: string[] }
  | { type: 'network'; level: 'good' | 'normal' | 'bad' };
/** `self` and `sentAt` let the chat show "You" and web's relative times. */
export type NativeChatMessage = {
  id: string;
  sender: string;
  text: string;
  self: boolean;
  sentAt: number;
};
export type NativeMediaDevice = { id: string; label: string; selected: boolean };
export type NativeMediaDevices = {
  cameras: NativeMediaDevice[];
  audio: NativeMediaDevice[];
  mirrored: boolean;
};
export interface NativeMeetingAdapter {
  pictureInPicture?: NativePictureInPictureAdapter;
  prepareAudio?(): Promise<void>;
  subscribe(listener: (event: NativeMeetingEvent) => void): () => void;
  join(
    credentials: LiveSessionJoinCredentialsVM,
    options: { microphone: boolean; camera: boolean },
  ): Promise<void>;
  leave(endForAll: boolean): Promise<void>;
  microphone(userId: string, enabled: boolean): Promise<void>;
  camera(enabled: boolean): Promise<void>;
  switchCamera(): Promise<void>;
  devices?(): Promise<NativeMediaDevices>;
  selectCamera?(id: string): Promise<void>;
  selectAudioRoute?(id: string): Promise<void>;
  mirror?(enabled: boolean): Promise<void>;
  shareMode?(): Promise<NativeShareMode>;
  setShareMode?(mode: NativeShareMode): Promise<void>;
  share(enabled: boolean): Promise<void>;
  cohost(userId: string, enabled: boolean): Promise<void>;
  host(userId: string): Promise<void>;
  claimHost(): Promise<void>;
  command(
    payload:
      | { type: 'raise-hand'; raised: boolean }
      | { type: 'reaction'; emoji: string },
  ): Promise<void>;
  captions(enabled: boolean): Promise<void>;
  recording(enabled: boolean): Promise<void>;
  resumeRecording?(): Promise<void>;
  pauseRecording?(): Promise<void>;
  recordingConsent?(accept: boolean): Promise<void>;
  chatPrivilege?(allowed: boolean): Promise<void>;
  chat(text: string): Promise<void>;
  /** Web's two-note chime; best effort and never blocks the call. */
  joinChime?(): Promise<void>;
  speaker(enabled: boolean): Promise<void>;
  testSpeaker(enabled: boolean): Promise<void>;
  testMicrophone(enabled: boolean): Promise<void>;
  stopAudioTests(): Promise<void>;
  background(mode: 'none' | 'blur' | 'image', filePath?: string): Promise<void>;
  originalAudio(enabled: boolean): Promise<void>;
}
export type NativeMeetingState = {
  phase: 'preview' | 'joining' | 'meeting' | 'reconnecting' | 'ended';
  selfId: string | null;
  participants: NativeParticipant[];
  speaking: string[];
  microphone: boolean;
  camera: boolean;
  /** The presenter on stage; `sharingUserIds` keeps every simultaneous presenter. */
  sharingUserId: string | null;
  sharingUserIds: string[];
  shareMode: NativeShareMode | null;
  recording: boolean;
  recordingPaused: boolean;
  recordingConsent: NativeRecordingConsent | null;
  chatAllowed: boolean;
  leaveReason: NativeLeaveReason | null;
  /** The OS revoked access mid-class; the screen offers a path to Settings. */
  permissionBlocked: 'camera' | 'microphone' | null;
  /** A phone call or Siri holds the device audio; it resumes when that ends. */
  audioInterrupted: boolean;
  error: string | null;
  composited: string[];
  network: 'good' | 'normal' | 'bad' | null;
  raisedHands: string[];
  reactions: Array<{ userId: string; emoji: string }>;
  caption: string;
  messages: NativeChatMessage[];
};
const initial = (): NativeMeetingState => ({
  phase: 'preview',
  selfId: null,
  participants: [],
  speaking: [],
  microphone: false,
  camera: true,
  sharingUserId: null,
  sharingUserIds: [],
  shareMode: null,
  recording: false,
  recordingPaused: false,
  recordingConsent: null,
  chatAllowed: true,
  leaveReason: null,
  permissionBlocked: null,
  audioInterrupted: false,
  error: null,
  messages: [],
  composited: [],
  network: null,
  raisedHands: [],
  reactions: [],
  caption: '',
});
/** SDK lifecycle and UI state are separate so failure/race paths run without native binaries. */
export class NativeMeetingController {
  state = initial();
  private listeners = new Set<() => void>();
  private disconnect: (() => void) | null = null;
  private disposed = false;
  private reactionTimers = new Set<ReturnType<typeof setTimeout>>();
  private captionTimer: ReturnType<typeof setTimeout> | null = null;
  private busy = false;
  private joinDeadline: ReturnType<typeof setTimeout> | null = null;
  settings: LiveSessionSettingsVM;
  constructor(
    readonly adapter: NativeMeetingAdapter,
    readonly credentials: LiveSessionJoinCredentialsVM,
  ) {
    this.settings = credentials.settings ?? DEFAULT_LIVE_SESSION_SETTINGS;
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  snapshot = () => this.state;
  private update(patch: Partial<NativeMeetingState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  setPreview(options: { microphone?: boolean; camera?: boolean }) {
    if (this.state.phase === 'preview') this.update(options);
  }
  async join(credentials = this.credentials) {
    if (this.busy || this.state.phase !== 'preview' || this.disposed) return;
    this.busy = true;
    this.settings = credentials.settings ?? DEFAULT_LIVE_SESSION_SETTINGS;
    this.disconnect ??= this.adapter.subscribe((event) => this.event(event));
    this.update({ phase: 'joining', error: null });
    this.joinDeadline = setTimeout(() => {
      if (this.state.phase !== 'joining' || this.disposed) return;
      this.disconnect?.();
      this.disconnect = null;
      void this.adapter
        .leave(false)
        .catch(() => {})
        .finally(() =>
          this.update({
            phase: 'preview',
            error: 'Joining timed out. Check your connection and try again.',
          }),
        );
    }, 30000);
    try {
      await this.adapter.join(credentials, this.state);
      if (this.disposed) await this.adapter.leave(false);
    } catch {
      if (this.joinDeadline) clearTimeout(this.joinDeadline);
      this.update({
        phase: 'preview',
        error: 'Unable to join. Check your connection and try again.',
      });
    } finally {
      this.busy = false;
    }
  }
  private event(event: NativeMeetingEvent) {
    switch (event.type) {
      case 'joined':
        if (this.joinDeadline) clearTimeout(this.joinDeadline);
        this.update({
          phase: 'meeting',
          selfId: event.selfId,
          participants: event.participants,
          leaveReason: null,
        });
        this.chime();
        this.enforceChatPolicy();
        break;
      case 'participants': {
        const wasHost = !!this.self?.host;
        const arrived = event.participants.some(
          (user) =>
            user.id !== this.state.selfId &&
            !this.state.participants.some((known) => known.id === user.id),
        );
        const self = event.participants.find((user) => user.id === this.state.selfId);
        const presenters = this.state.sharingUserIds.filter((id) =>
          event.participants.some((user) => user.id === id),
        );
        this.update({
          participants: event.participants,
          ...this.stage(presenters),
          speaking: this.state.speaking.filter((id) =>
            event.participants.some((user) => user.id === id && !user.muted),
          ),
          raisedHands: this.state.raisedHands.filter((id) =>
            event.participants.some((user) => user.id === id),
          ),
          ...(self ? { microphone: !self.muted, camera: self.video } : {}),
        });
        if (arrived && this.state.phase === 'meeting') this.chime();
        // Web applies the chat policy when it holds host; follow host transfers too.
        if (!wasHost && self?.host) this.enforceChatPolicy();
        break;
      }
      case 'left':
        this.clearEphemeral();
        if (this.joinDeadline) clearTimeout(this.joinDeadline);
        this.update({
          phase: 'ended',
          audioInterrupted: false,
          sharingUserId: null,
          sharingUserIds: [],
          recording: false,
          recordingPaused: false,
          recordingConsent: null,
          leaveReason: event.reason,
        });
        break;
      case 'error':
        if (this.state.phase === 'joining') {
          if (this.joinDeadline) clearTimeout(this.joinDeadline);
          this.disconnect?.();
          this.disconnect = null;
          void this.adapter
            .leave(false)
            .catch(() => {})
            .finally(() => this.update({ phase: 'preview', error: event.message }));
        } else this.update({ error: event.message });
        break;
      case 'share': {
        const known = this.state.sharingUserIds.includes(event.userId);
        if (!event.active) {
          this.update(
            this.stage(this.state.sharingUserIds.filter((id) => id !== event.userId)),
          );
          break;
        }
        // Like web, a newly started share takes the stage; pause/resume updates do not.
        this.update(
          known
            ? this.stage(this.state.sharingUserIds)
            : {
                sharingUserIds: [...this.state.sharingUserIds, event.userId],
                sharingUserId: event.userId,
              },
        );
        break;
      }
      case 'recording':
        this.update({
          recording: event.status !== 'stopped',
          recordingPaused: event.status === 'paused',
          ...(event.status === 'stopped' ? { recordingConsent: null } : {}),
        });
        break;
      case 'recording-consent':
        this.update({ recordingConsent: event.consent });
        break;
      case 'chat-privilege':
        this.update({ chatAllowed: event.allowed });
        break;
      case 'audio-interrupted':
        this.update({ audioInterrupted: event.active });
        break;
      case 'permission':
        this.update({
          permissionBlocked: event.device,
          ...(event.device === 'camera' ? { camera: false } : { microphone: false }),
        });
        break;
      case 'chat':
        this.update({
          messages: [
            ...this.state.messages.filter((message) => message.id !== event.id),
            event,
          ].slice(-200),
        });
        break;
      case 'hand':
        this.update({
          raisedHands: event.raised
            ? [...new Set([...this.state.raisedHands, event.userId])]
            : this.state.raisedHands.filter((id) => id !== event.userId),
        });
        break;
      case 'reaction': {
        this.update({
          reactions: [
            ...this.state.reactions.filter(
              (reaction) => reaction.userId !== event.userId,
            ),
            event,
          ].slice(-6),
        });
        const timer = setTimeout(() => {
          this.reactionTimers.delete(timer);
          this.update({
            reactions: this.state.reactions.filter((reaction) => reaction !== event),
          });
        }, 3000);
        this.reactionTimers.add(timer);
        break;
      }
      case 'composition':
        this.update({
          composited: event.active
            ? [...new Set([...this.state.composited, event.userId])]
            : this.state.composited.filter((id) => id !== event.userId),
        });
        break;
      case 'speaking':
        this.update({
          speaking: event.userIds.filter((id) =>
            this.state.participants.some((user) => user.id === id && !user.muted),
          ),
        });
        break;
      case 'network':
        this.update({ network: event.level });
        break;
      case 'caption':
        if (this.captionTimer) clearTimeout(this.captionTimer);
        this.update({ caption: event.text });
        this.captionTimer = setTimeout(() => this.update({ caption: '' }), 6000);
        break;
      case 'connection':
        if (this.state.phase === 'meeting' || this.state.phase === 'reconnecting')
          this.update({ phase: event.reconnecting ? 'reconnecting' : 'meeting' });
        break;
    }
  }
  /** Keep the viewed presenter while sharing; otherwise fall back like web. */
  private stage(presenters: string[]) {
    const current = this.state.sharingUserId;
    return {
      sharingUserIds: presenters,
      sharingUserId:
        current && presenters.includes(current) ? current : (presenters[0] ?? null),
    };
  }
  private chime() {
    void this.adapter.joinChime?.().catch(() => {});
  }
  private enforceChatPolicy() {
    const { visible, enabled } = this.settings.messages;
    if (!this.self?.host || (visible && enabled) || !this.adapter.chatPrivilege) return;
    void this.adapter
      .chatPrivilege(false)
      .then(() => this.update({ chatAllowed: false }))
      .catch(() =>
        this.update({ error: 'Unable to turn off chat for this class. Please retry.' }),
      );
  }
  /** Called after the OS reports access again, e.g. when returning from Settings. */
  permissionRestored(device: 'camera' | 'microphone') {
    if (this.state.permissionBlocked === device) this.update({ permissionBlocked: null });
  }
  viewShare(userId: string) {
    if (this.state.sharingUserIds.includes(userId))
      this.update({ sharingUserId: userId });
  }
  async refreshShareMode() {
    if (!this.adapter.shareMode) return;
    this.update({ shareMode: await this.adapter.shareMode() });
  }
  async setShareMode(mode: NativeShareMode) {
    if (!this.self?.host) throw new Error('Host access required');
    if (!this.adapter.setShareMode) throw new Error('Update the app to change sharing.');
    await this.adapter.setShareMode(mode);
    this.update({ shareMode: mode });
  }
  async respondToRecordingConsent(accept: boolean) {
    const consent = this.state.recordingConsent;
    if (!consent || !this.adapter.recordingConsent) return;
    await this.adapter.recordingConsent(accept);
    this.update({ recordingConsent: null });
    // Zoom removes traditional-consent decliners; make sure local state follows.
    if (!accept && consent === 'traditional' && this.state.phase !== 'ended')
      await this.leave().catch(() =>
        this.update({ phase: 'ended', leaveReason: 'self' }),
      );
  }
  private clearEphemeral() {
    for (const timer of this.reactionTimers) clearTimeout(timer);
    this.reactionTimers.clear();
    if (this.captionTimer) clearTimeout(this.captionTimer);
    this.captionTimer = null;
    this.update({ reactions: [], caption: '', speaking: [], raisedHands: [] });
  }
  get self() {
    return this.state.participants.find((user) => user.id === this.state.selfId);
  }
  private requireModerator() {
    if (!this.self?.host && !this.self?.cohost)
      throw new Error('Host or co-host access required');
  }
  async microphone(enabled: boolean) {
    if (!this.state.selfId) return;
    await this.adapter.microphone(this.state.selfId, enabled);
    this.update({ microphone: enabled });
  }
  async camera(enabled: boolean) {
    await this.adapter.camera(enabled);
    this.update({ camera: enabled });
  }
  async share(enabled: boolean) {
    await this.adapter.share(enabled);
  }
  async mute(userId: string) {
    this.requireModerator();
    await this.adapter.microphone(userId, false);
  }
  async cohost(userId: string, enabled: boolean) {
    if (!this.self?.host || !this.settings.cohosts?.enabled)
      throw new Error('Co-host controls are unavailable');
    await this.adapter.cohost(userId, enabled);
  }
  async raiseHand(raised: boolean) {
    await this.adapter.command({ type: 'raise-hand', raised });
    if (this.state.selfId)
      this.event({ type: 'hand', userId: this.state.selfId, raised });
  }
  async react(emoji: string) {
    await this.adapter.command({ type: 'reaction', emoji });
    if (this.state.selfId)
      this.event({ type: 'reaction', userId: this.state.selfId, emoji });
  }
  async claimHost() {
    await this.adapter.claimHost();
  }
  async transferHost(userId: string) {
    if (!this.self?.host) throw new Error('Host access required');
    await this.adapter.host(userId);
  }
  async recording(enabled: boolean) {
    this.requireModerator();
    if (!this.settings.recording.enabled)
      throw new Error('Recording controls are unavailable');
    // Web resumes a paused recording from the same control instead of stopping it.
    if (enabled && this.state.recordingPaused) {
      if (!this.adapter.resumeRecording)
        throw new Error('Update the app to resume recording.');
      await this.adapter.resumeRecording();
      return;
    }
    if (!enabled && !this.settings.recording.allowStop)
      throw new Error('Recording controls are unavailable');
    await this.adapter.recording(enabled);
  }
  async pauseRecording() {
    this.requireModerator();
    if (
      !this.settings.recording.enabled ||
      !this.settings.recording.allowStop ||
      !this.state.recording ||
      this.state.recordingPaused
    )
      throw new Error('Pausing recording is unavailable');
    if (!this.adapter.pauseRecording)
      throw new Error('Update the app to pause recording.');
    await this.adapter.pauseRecording();
  }
  async chat(text: string) {
    if (!this.settings.messages.enabled || !text.trim()) return;
    if (!this.state.chatAllowed) throw new Error('The host has turned off chat.');
    await this.adapter.chat(text.trim());
  }
  async leave(endForAll = false) {
    if (endForAll && !this.self?.host) throw new Error('Host access required');
    await this.adapter.leave(endForAll);
    this.clearEphemeral();
    this.update({ phase: 'ended', leaveReason: this.state.leaveReason ?? 'self' });
  }
  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clearEphemeral();
    if (this.joinDeadline) clearTimeout(this.joinDeadline);
    this.disconnect?.();
    this.disconnect = null;
    this.listeners.clear();
    await this.adapter.stopAudioTests().catch(() => {});
    if (this.state.phase !== 'preview' && this.state.phase !== 'ended')
      await this.adapter.leave(false);
  }
}

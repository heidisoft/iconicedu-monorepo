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
export type NativeMeetingEvent =
  | { type: 'joined'; selfId: string; participants: NativeParticipant[] }
  | { type: 'participants'; participants: NativeParticipant[] }
  | { type: 'left'; reason: string }
  | { type: 'error'; message: string }
  | { type: 'share'; userId: string | null }
  | { type: 'recording'; active: boolean }
  | { type: 'chat'; id: string; sender: string; text: string }
  | { type: 'connection'; reconnecting: boolean }
  | { type: 'hand'; userId: string; raised: boolean }
  | { type: 'reaction'; userId: string; emoji: string }
  | { type: 'caption'; text: string }
  | { type: 'composition'; userId: string; active: boolean }
  | { type: 'network'; level: 'good' | 'normal' | 'bad' };
export interface NativeMeetingAdapter {
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
  mirror?(enabled: boolean): Promise<void>;
  lockSharing?(locked: boolean): Promise<void>;
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
  chat(text: string): Promise<void>;
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
  microphone: boolean;
  camera: boolean;
  sharingUserId: string | null;
  recording: boolean;
  error: string | null;
  composited: string[];
  network: 'good' | 'normal' | 'bad' | null;
  raisedHands: string[];
  reactions: Array<{ userId: string; emoji: string }>;
  caption: string;
  messages: Array<{ id: string; sender: string; text: string }>;
};
const initial = (): NativeMeetingState => ({
  phase: 'preview',
  selfId: null,
  participants: [],
  microphone: false,
  camera: true,
  sharingUserId: null,
  recording: false,
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
        });
        break;
      case 'participants': {
        const self = event.participants.find((user) => user.id === this.state.selfId);
        this.update({
          participants: event.participants,
          ...(self ? { microphone: !self.muted, camera: self.video } : {}),
        });
        break;
      }
      case 'left':
        if (this.joinDeadline) clearTimeout(this.joinDeadline);
        this.update({ phase: 'ended', sharingUserId: null, recording: false });
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
      case 'share':
        this.update({ sharingUserId: event.userId });
        break;
      case 'recording':
        this.update({ recording: event.active });
        break;
      case 'chat':
        this.update({ messages: [...this.state.messages, event].slice(-200) });
        break;
      case 'hand':
        this.update({
          raisedHands: event.raised
            ? [...new Set([...this.state.raisedHands, event.userId])]
            : this.state.raisedHands.filter((id) => id !== event.userId),
        });
        break;
      case 'reaction':
        this.update({ reactions: [...this.state.reactions, event].slice(-6) });
        break;
      case 'composition':
        this.update({
          composited: event.active
            ? [...new Set([...this.state.composited, event.userId])]
            : this.state.composited.filter((id) => id !== event.userId),
        });
        break;
      case 'network':
        this.update({ network: event.level });
        break;
      case 'caption':
        this.update({ caption: event.text });
        break;
      case 'connection':
        if (this.state.phase === 'meeting' || this.state.phase === 'reconnecting')
          this.update({ phase: event.reconnecting ? 'reconnecting' : 'meeting' });
        break;
    }
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
    if (
      !this.settings.recording.enabled ||
      (!enabled && !this.settings.recording.allowStop)
    )
      throw new Error('Recording controls are unavailable');
    await this.adapter.recording(enabled);
  }
  async chat(text: string) {
    if (!this.settings.messages.enabled || !text.trim()) return;
    await this.adapter.chat(text.trim());
  }
  async leave(endForAll = false) {
    if (endForAll && !this.self?.host) throw new Error('Host access required');
    await this.adapter.leave(endForAll);
    this.update({ phase: 'ended' });
  }
  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.joinDeadline) clearTimeout(this.joinDeadline);
    this.disconnect?.();
    this.disconnect = null;
    this.listeners.clear();
    await this.adapter.stopAudioTests().catch(() => {});
    if (this.state.phase !== 'preview' && this.state.phase !== 'ended')
      await this.adapter.leave(false);
  }
}

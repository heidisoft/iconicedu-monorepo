import {
  NativeMeetingController,
  type NativeMeetingAdapter,
  type NativeMeetingEvent,
  type NativeParticipant,
} from './meeting-controller';
import {
  DEFAULT_LIVE_SESSION_SETTINGS,
  type LiveSessionJoinCredentialsVM,
} from '@iconicedu/shared-types';
const credentials: LiveSessionJoinCredentialsVM = {
  token: 'synthetic-sdk-token',
  sessionName: 'Test classroom',
  displayName: 'Teacher',
  expiresAt: null,
  settings: { ...DEFAULT_LIVE_SESSION_SETTINGS, cohosts: { enabled: true } },
};
const teacher: NativeParticipant = {
  id: '1',
  name: 'Teacher',
  host: true,
  cohost: false,
  muted: true,
  video: true,
};
const student: NativeParticipant = {
  id: '2',
  name: 'Student',
  host: false,
  cohost: false,
  muted: false,
  video: true,
};
const controllers: NativeMeetingController[] = [];
afterEach(async () => {
  for (const controller of controllers.splice(0)) await controller.dispose();
});
function fixture() {
  let emit: (event: NativeMeetingEvent) => void = () => {};
  const disconnect = jest.fn();
  const adapter: jest.Mocked<NativeMeetingAdapter> = {
    subscribe: jest.fn((listener) => {
      emit = listener;
      return disconnect;
    }),
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    microphone: jest.fn().mockResolvedValue(undefined),
    camera: jest.fn().mockResolvedValue(undefined),
    switchCamera: jest.fn().mockResolvedValue(undefined),
    share: jest.fn().mockResolvedValue(undefined),
    cohost: jest.fn().mockResolvedValue(undefined),
    claimHost: jest.fn().mockResolvedValue(undefined),
    command: jest.fn().mockResolvedValue(undefined),
    captions: jest.fn().mockResolvedValue(undefined),
    host: jest.fn().mockResolvedValue(undefined),
    recording: jest.fn().mockResolvedValue(undefined),
    chat: jest.fn().mockResolvedValue(undefined),
    speaker: jest.fn().mockResolvedValue(undefined),
    testSpeaker: jest.fn().mockResolvedValue(undefined),
    background: jest.fn().mockResolvedValue(undefined),
    originalAudio: jest.fn().mockResolvedValue(undefined),
    stopAudioTests: jest.fn().mockResolvedValue(undefined),
    testMicrophone: jest.fn().mockResolvedValue(undefined),
  };
  const controller = new NativeMeetingController(
    adapter,
    JSON.parse(JSON.stringify(credentials)),
  );
  controllers.push(controller);
  return {
    controller,
    adapter,
    disconnect,
    emit: (event: NativeMeetingEvent) => emit(event),
    connected: async (selfId = '1', participants = [teacher, student]) => {
      await controller.join();
      emit({ type: 'joined', selfId, participants });
    },
  };
}
describe('native classroom lifecycle and permissions', () => {
  it('uses settings renewed by the API when joining from preview', async () => {
    const f = fixture();
    const renewed = {
      ...credentials,
      settings: { ...DEFAULT_LIVE_SESSION_SETTINGS, cohosts: { enabled: false } },
    };
    await f.controller.join(renewed);
    expect(f.controller.settings.cohosts.enabled).toBe(false);
    expect(f.adapter.join).toHaveBeenCalledWith(renewed, expect.any(Object));
  });

  it('requires explicit join after preview, with camera on and microphone muted by default', async () => {
    const f = fixture();
    expect(f.adapter.join).not.toHaveBeenCalled();
    expect(f.controller.state.phase).toBe('preview');
    await f.controller.join();
    expect(f.adapter.join).toHaveBeenCalledWith(
      credentials,
      expect.objectContaining({ microphone: false, camera: true }),
    );
    expect(f.controller.state.phase).toBe('joining');
    f.emit({ type: 'joined', selfId: '1', participants: [teacher] });
    expect(f.controller.state.phase).toBe('meeting');
  });
  it('prevents duplicate joins and registers listeners before joining', async () => {
    const f = fixture();
    let finish!: () => void;
    f.adapter.join.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const joining = f.controller.join();
    await f.controller.join();
    expect(f.adapter.join).toHaveBeenCalledTimes(1);
    expect(f.adapter.subscribe.mock.invocationCallOrder[0]).toBeLessThan(
      f.adapter.join.mock.invocationCallOrder[0],
    );
    finish();
    await joining;
  });
  it('recovers a rejected join without leaking a token into the error', async () => {
    const f = fixture();
    f.adapter.join.mockRejectedValueOnce(new Error(credentials.token));
    await f.controller.join();
    expect(f.controller.state.phase).toBe('preview');
    expect(f.controller.state.error).not.toContain(credentials.token);
    await f.controller.join();
    expect(f.adapter.join).toHaveBeenCalledTimes(2);
  });
  it('preserves preview choices and only changes UI after SDK success', async () => {
    const f = fixture();
    f.controller.setPreview({ microphone: true, camera: false });
    await f.connected();
    f.adapter.camera.mockRejectedValueOnce(new Error('device unavailable'));
    await expect(f.controller.camera(true)).rejects.toThrow();
    expect(f.controller.state.camera).toBe(false);
    await f.controller.camera(true);
    expect(f.controller.state.camera).toBe(true);
  });
  it.each(['mute', 'recording'] as const)(
    'rejects student %s before touching the SDK',
    async (method) => {
      const f = fixture();
      await f.connected('2');
      await expect(
        method === 'mute' ? f.controller.mute('1') : f.controller.recording(true),
      ).rejects.toThrow('Host or co-host');
      expect(
        f.adapter[method === 'mute' ? 'microphone' : 'recording'],
      ).not.toHaveBeenCalled();
    },
  );
  it('allows co-host moderation but reserves transfers and end-for-all for host', async () => {
    const f = fixture();
    await f.connected('2', [teacher, { ...student, cohost: true }]);
    await f.controller.mute('1');
    await f.controller.recording(true);
    await expect(f.controller.transferHost('2')).rejects.toThrow();
    await expect(f.controller.leave(true)).rejects.toThrow();
  });
  it('does not automatically take host when an eligible teacher joins', async () => {
    const f = fixture();
    await f.connected();
    expect(f.adapter.host).not.toHaveBeenCalled();
    await f.controller.transferHost('2');
    expect(f.adapter.host).toHaveBeenCalledWith('2');
  });
  it('assigns and revokes co-hosts explicitly', async () => {
    const f = fixture();
    await f.connected();
    await f.controller.cohost('2', true);
    await f.controller.cohost('2', false);
    expect(f.adapter.cohost.mock.calls).toEqual([
      ['2', true],
      ['2', false],
    ]);
  });
  it('enforces meeting settings for chat, recording and co-hosts', async () => {
    const f = fixture();
    await f.connected();
    f.controller.settings.messages.enabled = false;
    await f.controller.chat('hello');
    expect(f.adapter.chat).not.toHaveBeenCalled();
    f.controller.settings.messages.enabled = true;
    f.controller.settings.recording.allowStop = false;
    await expect(f.controller.recording(false)).rejects.toThrow();
    f.controller.settings.recording.allowStop = true;
  });
  it('receives screen shares, recording, chat, mute and reconnect events', async () => {
    const f = fixture();
    await f.connected();
    f.emit({ type: 'share', userId: '2', active: true });
    f.emit({ type: 'recording', status: 'recording' });
    f.emit({
      type: 'chat',
      id: 'm1',
      sender: 'Student',
      text: 'Hello',
      self: false,
      sentAt: 0,
    });
    f.emit({ type: 'connection', reconnecting: true });
    expect(f.controller.state).toMatchObject({
      sharingUserId: '2',
      recording: true,
      phase: 'reconnecting',
    });
    f.emit({ type: 'connection', reconnecting: false });
    f.emit({
      type: 'participants',
      participants: [{ ...teacher, muted: false }, student],
    });
    expect(f.controller.state.microphone).toBe(true);
    expect(f.controller.state.messages).toHaveLength(1);
  });
  it('sends hand and reaction commands compatible with web peers', async () => {
    const f = fixture();
    await f.connected();
    await f.controller.raiseHand(true);
    await f.controller.react('👏');
    expect(f.adapter.command.mock.calls).toEqual([
      [{ type: 'raise-hand', raised: true }],
      [{ type: 'reaction', emoji: '👏' }],
    ]);
    expect(f.controller.state.raisedHands).toEqual(['1']);
    f.emit({ type: 'hand', userId: '2', raised: true });
    await f.controller.raiseHand(false);
    expect(f.controller.state.raisedHands).toEqual(['2']);
  });
  it('cleans subscriptions, audio tests and native session on unmount', async () => {
    const f = fixture();
    await f.connected();
    await f.controller.dispose();
    expect(f.disconnect).toHaveBeenCalledTimes(1);
    expect(f.adapter.stopAudioTests).toHaveBeenCalled();
    expect(f.adapter.leave).toHaveBeenCalledWith(false);
    f.emit({ type: 'recording', status: 'recording' });
    expect(f.controller.state.recording).toBe(false);
  });
  it('keeps simultaneous presenters on stage and falls back when one stops', async () => {
    const f = fixture();
    await f.connected('1', [teacher, student, { ...student, id: '3', name: 'Peer' }]);
    f.emit({ type: 'share', userId: '2', active: true });
    f.emit({ type: 'share', userId: '3', active: true });
    expect(f.controller.state).toMatchObject({
      sharingUserIds: ['2', '3'],
      sharingUserId: '3',
    });
    f.controller.viewShare('2');
    // A pause/resume update for a known presenter does not steal the stage.
    f.emit({ type: 'share', userId: '3', active: true });
    expect(f.controller.state.sharingUserId).toBe('2');
    f.emit({ type: 'share', userId: '2', active: false });
    expect(f.controller.state).toMatchObject({
      sharingUserIds: ['3'],
      sharingUserId: '3',
    });
    f.emit({ type: 'participants', participants: [teacher, student] });
    expect(f.controller.state).toMatchObject({ sharingUserIds: [], sharingUserId: null });
    f.controller.viewShare('9');
    expect(f.controller.state.sharingUserId).toBeNull();
  });
  it('lets only the host change who can share', async () => {
    const f = fixture();
    f.adapter.shareMode = jest.fn().mockResolvedValue('locked');
    f.adapter.setShareMode = jest.fn().mockResolvedValue(undefined);
    await f.connected('2');
    await expect(f.controller.setShareMode('multiple')).rejects.toThrow('Host access');
    f.emit({ type: 'participants', participants: [teacher, { ...student, host: true }] });
    await f.controller.refreshShareMode();
    expect(f.controller.state.shareMode).toBe('locked');
    await f.controller.setShareMode('multiple');
    expect(f.adapter.setShareMode).toHaveBeenCalledWith('multiple');
    expect(f.controller.state.shareMode).toBe('multiple');
  });
  it('limits pausing to moderators and classes that permit stopping', async () => {
    const f = fixture();
    f.adapter.pauseRecording = jest.fn().mockResolvedValue(undefined);
    await f.connected('2');
    f.emit({ type: 'recording', status: 'recording' });
    await expect(f.controller.pauseRecording()).rejects.toThrow();
    f.emit({
      type: 'participants',
      participants: [teacher, { ...student, cohost: true }],
    });
    await f.controller.pauseRecording();
    expect(f.adapter.pauseRecording).toHaveBeenCalledTimes(1);
    f.controller.settings.recording.allowStop = false;
    await expect(f.controller.pauseRecording()).rejects.toThrow();
    expect(f.adapter.pauseRecording).toHaveBeenCalledTimes(1);
  });
  it('resumes a paused recording from the record control even when stopping is locked', async () => {
    const f = fixture();
    f.controller.settings.recording.allowStop = false;
    f.adapter.resumeRecording = jest.fn().mockResolvedValue(undefined);
    await f.connected();
    f.emit({ type: 'recording', status: 'paused' });
    expect(f.controller.state).toMatchObject({ recording: true, recordingPaused: true });
    await f.controller.recording(true);
    expect(f.adapter.resumeRecording).toHaveBeenCalledTimes(1);
    expect(f.adapter.recording).not.toHaveBeenCalled();
    f.emit({ type: 'recording', status: 'recording' });
    await expect(f.controller.recording(false)).rejects.toThrow('unavailable');
  });
  it('stays in class after declining individual recording consent', async () => {
    const f = fixture();
    f.adapter.recordingConsent = jest.fn().mockResolvedValue(undefined);
    await f.connected('2');
    f.emit({ type: 'recording', status: 'recording' });
    f.emit({ type: 'recording-consent', consent: 'individual' });
    await f.controller.respondToRecordingConsent(false);
    expect(f.adapter.recordingConsent).toHaveBeenCalledWith(false);
    expect(f.adapter.leave).not.toHaveBeenCalled();
    expect(f.controller.state).toMatchObject({
      phase: 'meeting',
      recordingConsent: null,
    });
  });
  it('leaves class after declining traditional recording consent', async () => {
    const f = fixture();
    f.adapter.recordingConsent = jest.fn().mockResolvedValue(undefined);
    await f.connected('2');
    f.emit({ type: 'recording-consent', consent: 'traditional' });
    await f.controller.respondToRecordingConsent(false);
    expect(f.adapter.leave).toHaveBeenCalledWith(false);
    expect(f.controller.state).toMatchObject({ phase: 'ended', leaveReason: 'self' });
  });
  it('clears an unanswered consent prompt once recording stops', async () => {
    const f = fixture();
    await f.connected('2');
    f.emit({ type: 'recording-consent', consent: 'traditional' });
    f.emit({ type: 'recording', status: 'stopped' });
    expect(f.controller.state.recordingConsent).toBeNull();
  });
  it('turns chat off for everyone when the host has messages disabled, like web', async () => {
    const f = fixture();
    f.controller.settings.messages = { visible: true, enabled: false };
    f.adapter.chatPrivilege = jest.fn().mockResolvedValue(undefined);
    await f.connected('2');
    expect(f.adapter.chatPrivilege).not.toHaveBeenCalled();
    // Becoming host through a transfer applies the policy too.
    f.emit({ type: 'participants', participants: [teacher, { ...student, host: true }] });
    await Promise.resolve();
    expect(f.adapter.chatPrivilege).toHaveBeenCalledWith(false);
    expect(f.controller.state.chatAllowed).toBe(false);
  });
  it('blocks sending after the host turns chat off', async () => {
    const f = fixture();
    await f.connected();
    f.emit({ type: 'chat-privilege', allowed: false });
    await expect(f.controller.chat('Hello')).rejects.toThrow('turned off chat');
    expect(f.adapter.chat).not.toHaveBeenCalled();
  });
  it('turns the blocked device off and clears the block once access returns', async () => {
    const f = fixture();
    await f.connected();
    f.emit({
      type: 'participants',
      participants: [{ ...teacher, muted: false }, student],
    });
    f.emit({ type: 'permission', device: 'microphone' });
    expect(f.controller.state).toMatchObject({
      permissionBlocked: 'microphone',
      microphone: false,
    });
    f.controller.permissionRestored('camera');
    expect(f.controller.state.permissionBlocked).toBe('microphone');
    f.controller.permissionRestored('microphone');
    expect(f.controller.state.permissionBlocked).toBeNull();
  });
  it('chimes like web when you join and when someone new arrives, not on refreshes', async () => {
    const f = fixture();
    f.adapter.joinChime = jest.fn().mockResolvedValue(undefined);
    await f.connected('1', [teacher]);
    expect(f.adapter.joinChime).toHaveBeenCalledTimes(1);
    f.emit({ type: 'participants', participants: [teacher, student] });
    expect(f.adapter.joinChime).toHaveBeenCalledTimes(2);
    f.emit({
      type: 'participants',
      participants: [{ ...teacher, muted: false }, student],
    });
    f.emit({ type: 'participants', participants: [teacher] });
    expect(f.adapter.joinChime).toHaveBeenCalledTimes(2);
  });
  it('records why the session ended', async () => {
    const f = fixture();
    await f.connected('2');
    f.emit({ type: 'left', reason: 'ended-by-host' });
    expect(f.controller.state).toMatchObject({
      phase: 'ended',
      leaveReason: 'ended-by-host',
    });
  });
  it('does not leave another session when preview is dismissed', async () => {
    const f = fixture();
    await f.controller.dispose();
    expect(f.adapter.leave).not.toHaveBeenCalled();
  });
});

it('expires reactions, deduplicates repeated messages, and clears departed speakers', async () => {
  jest.useFakeTimers();
  const f = fixture();
  await f.connected();
  f.emit({ type: 'reaction', userId: '2', emoji: '👍' });
  expect(f.controller.snapshot().reactions).toHaveLength(1);
  jest.advanceTimersByTime(3000);
  expect(f.controller.snapshot().reactions).toHaveLength(0);
  const message = {
    type: 'chat' as const,
    id: 'same-message',
    sender: 'Student',
    text: 'Hello',
    self: false,
    sentAt: 0,
  };
  f.emit(message);
  f.emit(message);
  expect(f.controller.snapshot().messages).toHaveLength(1);
  f.emit({ type: 'speaking', userIds: ['1', '2', 'unknown'] });
  expect(f.controller.snapshot().speaking).toEqual(['2']);
  f.emit({ type: 'participants', participants: [teacher] });
  expect(f.controller.snapshot().speaking).toEqual([]);
  jest.useRealTimers();
});

it('clears inactive captions after six seconds and removes ephemeral content on leave', async () => {
  jest.useFakeTimers();
  const f = fixture();
  await f.connected();
  f.emit({ type: 'caption', text: 'First sentence' });
  jest.advanceTimersByTime(5000);
  f.emit({ type: 'caption', text: 'Second sentence' });
  jest.advanceTimersByTime(5000);
  expect(f.controller.snapshot().caption).toBe('Second sentence');
  jest.advanceTimersByTime(1000);
  expect(f.controller.snapshot().caption).toBe('');
  f.emit({ type: 'caption', text: 'Leaving now' });
  f.emit({ type: 'reaction', userId: '2', emoji: '👍' });
  await f.controller.leave();
  expect(f.controller.snapshot()).toMatchObject({
    caption: '',
    reactions: [],
    speaking: [],
    raisedHands: [],
  });
  jest.useRealTimers();
});

it('bounds timeout recovery even when SDK join and leave promises never resolve', async () => {
  jest.useFakeTimers();
  const f = fixture();
  f.adapter.join.mockImplementationOnce(() => new Promise(() => {}));
  f.adapter.leave.mockImplementationOnce(() => new Promise(() => {}));
  void f.controller.join();
  await jest.advanceTimersByTimeAsync(35000);
  expect(f.controller.state.phase).toBe('preview');
  expect(f.controller.state.error).toContain('timed out');
  await f.controller.join();
  expect(f.adapter.join).toHaveBeenCalledTimes(2);
  f.emit({ type: 'joined', selfId: '1', participants: [teacher] });
  expect(f.controller.state.phase).toBe('meeting');
  jest.useRealTimers();
});

it('retains all received chat messages through a long lesson', async () => {
  const f = fixture();
  await f.connected();
  for (let i = 0; i < 250; i++)
    f.emit({
      type: 'chat',
      id: String(i),
      sender: 'Student',
      text: String(i),
      self: false,
      sentAt: i,
    });
  expect(f.controller.snapshot().messages).toHaveLength(250);
  expect(f.controller.snapshot().messages[0].text).toBe('0');
});
it('requires published annotation content before recording a shared screen', async () => {
  const f = fixture();
  await f.connected();
  f.emit({ type: 'share', userId: '2', active: true });
  await expect(f.controller.recording(true)).rejects.toThrow(
    'not publishing annotations',
  );
  expect(f.adapter.recording).not.toHaveBeenCalled();
  f.emit({ type: 'composition', userId: '2', active: true });
  await f.controller.recording(true);
  expect(f.adapter.recording).toHaveBeenCalledWith(true);
});
it('pauses once when a composed presenter stops publishing', async () => {
  const f = fixture();
  f.adapter.pauseRecording = jest.fn().mockResolvedValue(undefined);
  await f.connected();
  f.emit({ type: 'share', userId: '2', active: true });
  f.emit({ type: 'composition', userId: '2', active: true });
  f.emit({ type: 'recording', status: 'recording' });
  f.emit({ type: 'composition', userId: '2', active: false });
  f.emit({ type: 'composition', userId: '2', active: false });
  await Promise.resolve();
  expect(f.adapter.pauseRecording).toHaveBeenCalledTimes(1);
  expect(f.controller.snapshot().error).toContain('publishing stopped');
});

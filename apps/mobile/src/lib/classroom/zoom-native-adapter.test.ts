import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { createZoomNativeAdapter } from './zoom-native-adapter';
import type { useZoom } from '@zoom/react-native-videosdk';
jest.mock('@zoom/react-native-videosdk', () => ({
  Errors: { Success: 'ZoomVideoSDKError_Success' },
  ShareStatus: {
    Stop: 'ZoomVideoSDKShareStatus_Stop',
    None: 'ZoomVideoSDKShareStatus_None',
  },
  RecordingStatus: { Start: 'ZoomVideoSDKRecordingStatus_Start' },
  EventType: Object.fromEntries(
    [
      'onUserVideoNetworkStatusChanged',
      'onSessionJoin',
      'onSessionLeave',
      'onUserJoin',
      'onUserLeave',
      'onUserHostChanged',
      'onUserManagerChanged',
      'onUserAudioStatusChanged',
      'onUserVideoStatusChanged',
      'onUserNameChanged',
      'onError',
      'onUserShareStatusChanged',
      'onCloudRecordingStatus',
      'onChatNewMessageNotify',
      'onUserFailoverStatusChanged',
      'onOriginalLanguageMsgReceived',
      'onCommandReceived',
    ].map((key) => [key, key]),
  ),
  ZoomVideoSdkUser: jest.fn((value) => ({
    ...value,
    getUserName: async () => value.userName,
    getIsHost: async () => value.isHost,
    getIsManager: async () => value.isManager,
    audioStatus: { isMuted: async () => true },
    videoStatus: { isOn: async () => false },
  })),
}));
function fixture() {
  const listeners = new Map<string, (value?: unknown) => void>();
  const remove = jest.fn();
  const success = () => jest.fn().mockResolvedValue('ZoomVideoSDKError_Success');
  const zoom = {
    addListener: jest.fn((event, listener) => {
      listeners.set(event, listener);
      return { remove };
    }),
    session: {
      getMySelf: jest.fn().mockResolvedValue({
        userId: '1',
        userName: 'Teacher',
        isHost: true,
        isManager: false,
      }),
      getRemoteUsers: jest.fn().mockResolvedValue([]),
    },
    joinSession: jest.fn().mockResolvedValue(undefined),
    leaveSession: jest.fn(),
    audioHelper: { unmuteAudio: success(), muteAudio: success(), setSpeaker: success() },
    videoHelper: {
      startVideo: success(),
      stopVideo: success(),
      mirrorMyVideo: success(),
      switchCamera: jest.fn().mockResolvedValue(true),
    },
    shareHelper: {
      shareScreen: jest.fn(),
      stopShare: success(),
      isOtherSharing: jest.fn().mockResolvedValue(false),
      lockShare: success(),
      isShareLocked: jest.fn().mockResolvedValue(false),
    },
    userHelper: {
      makeManager: jest.fn().mockResolvedValue(true),
      revokeManager: jest.fn().mockResolvedValue(0),
      makeHost: jest.fn().mockResolvedValue(true),
    },
    recordingHelper: {
      getCloudRecordingStatus: jest.fn().mockResolvedValue('stopped'),
      startCloudRecording: success(),
      stopCloudRecording: success(),
    },
    chatHelper: { sendChatToAll: success() },
    testAudioDeviceHelper: {
      startMicTest: success(),
      stopMicTest: success(),
      playMicTest: success(),
      startSpeakerTest: success(),
      stopSpeakerTest: success(),
    },
    cmdChannel: { sendCommand: success() },
    liveTranscriptionHelper: {
      canStartLiveTranscription: jest.fn().mockResolvedValue(true),
      startLiveTranscription: success(),
      enableReceiveSpokenLanguageContent: success(),
    },
  };
  NativeModules.RNZoomVideoSdk = {
    leaveSession: jest.fn().mockResolvedValue('ZoomVideoSDKError_Success'),
  };
  NativeModules.ClassroomControls = {
    startMeetingService: jest.fn().mockResolvedValue(true),
    stopMeetingService: jest.fn().mockResolvedValue(true),
    startScreenShare: jest.fn().mockResolvedValue(true),
    claimHost: jest.fn().mockResolvedValue(true),
    stopShareService: jest.fn().mockResolvedValue(true),
  };
  return {
    zoom,
    listeners,
    remove,
    adapter: createZoomNativeAdapter(zoom as unknown as ReturnType<typeof useZoom>),
  };
}
describe('Zoom native bridge adapter', () => {
  it('reports recording already active when joining an existing classroom', async () => {
    const f = fixture();
    f.zoom.recordingHelper.getCloudRecordingStatus.mockResolvedValue(
      'ZoomVideoSDKRecordingStatus_Start',
    );
    const receive = jest.fn();
    const dispose = f.adapter.subscribe(receive);
    f.listeners.get('onSessionJoin')?.();
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
    expect(receive).toHaveBeenCalledWith({ type: 'recording', active: true });
    dispose();
  });

  it('passes server credentials without setting the application passcode as a Zoom session password', async () => {
    const f = fixture();
    const raf = jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        callback(0);
        return 0;
      });
    await f.adapter.join(
      {
        sessionName: 'test',
        displayName: 'Verified student',
        token: 'synthetic',
        meetingPasscode: 'application-only',
        expiresAt: null,
      },
      { microphone: false, camera: true },
    );
    expect(f.zoom.joinSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userName: 'Verified student',
        token: 'synthetic',
        audioOptions: expect.objectContaining({ mute: true }),
      }),
    );
    expect(f.zoom.joinSession.mock.calls[0][0]).not.toHaveProperty('sessionPassword');
    raf.mockRestore();
  });
  it('requests Android headset permission once and allows joining if it is denied', async () => {
    const f = fixture();
    const os = jest.replaceProperty(Platform, 'OS', 'android');
    const descriptor = Object.getOwnPropertyDescriptor(Platform, 'Version');
    Object.defineProperty(Platform, 'Version', { configurable: true, value: 36 });
    const check = jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    const request = jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
    const raf = jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        callback(0);
        return 0;
      });
    try {
      await f.adapter.prepareAudio?.();
      await f.adapter.join(
        { sessionName: 'test', displayName: 'Test', token: 'synthetic', expiresAt: null },
        { microphone: false, camera: false },
      );
      expect(request).toHaveBeenCalledWith(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      );
      expect(f.zoom.joinSession).toHaveBeenCalled();
    } finally {
      os.restore();
      if (descriptor) Object.defineProperty(Platform, 'Version', descriptor);
      check.mockRestore();
      request.mockRestore();
      raf.mockRestore();
    }
  });
  it('handles the native numeric success code for revoking a co-host and rejects false', async () => {
    const f = fixture();
    await f.adapter.cohost('2', false);
    f.zoom.userHelper.makeManager.mockResolvedValue(false);
    await expect(f.adapter.cohost('2', true)).rejects.toThrow();
  });
  it('uses the preferred ReplayKit broadcast extension on iPad', async () => {
    const f = fixture();
    const os = jest.replaceProperty(Platform, 'OS', 'ios');
    await f.adapter.share(true);
    expect(NativeModules.ClassroomControls.startScreenShare).toHaveBeenCalled();
    expect(f.zoom.shareHelper.shareScreen).not.toHaveBeenCalled();
    os.restore();
  });
  it('does not open capture consent when sharing is locked or someone is presenting', async () => {
    const f = fixture();
    f.zoom.shareHelper.isOtherSharing.mockResolvedValue(true);
    await expect(f.adapter.share(true)).rejects.toThrow();
    expect(f.zoom.shareHelper.shareScreen).not.toHaveBeenCalled();
  });
  it('delegates mirroring and sharing restrictions to native SDK controls', async () => {
    const f = fixture();
    await f.adapter.mirror!(true);
    await f.adapter.lockSharing!(true);
    expect(f.zoom.videoHelper.mirrorMyVideo).toHaveBeenCalledWith(true);
    expect(f.zoom.shareHelper.lockShare).toHaveBeenCalledWith(true);
  });
  it('allows the SDK host to share when participant sharing is locked', async () => {
    const f = fixture();
    f.zoom.shareHelper.isShareLocked.mockResolvedValue(true);
    await expect(f.adapter.share(true)).resolves.toBeUndefined();
  });
  it('blocks a participant from starting capture when sharing is locked', async () => {
    const f = fixture();
    f.zoom.shareHelper.isShareLocked.mockResolvedValue(true);
    f.zoom.session.getMySelf.mockResolvedValue({
      userId: '2',
      userName: 'Student',
      isHost: false,
      isManager: false,
    });
    await expect(f.adapter.share(true)).rejects.toThrow('Screen sharing is unavailable');
    expect(f.zoom.shareHelper.shareScreen).not.toHaveBeenCalled();
    expect(NativeModules.ClassroomControls.startScreenShare).not.toHaveBeenCalled();
  });
  it('stops the Android capture service when leaving or stopping share', async () => {
    const f = fixture();
    await f.adapter.share(false);
    await f.adapter.leave(false);
    expect(NativeModules.ClassroomControls.stopShareService).toHaveBeenCalledTimes(2);
  });
  it('does not issue host-reclaim on join and only calls the native bridge explicitly', async () => {
    const f = fixture();
    await f.adapter.claimHost();
    expect(NativeModules.ClassroomControls.claimHost).toHaveBeenCalledTimes(1);
  });
  it('records and plays a microphone test only after it has started', async () => {
    const f = fixture();
    await f.adapter.testMicrophone(false);
    expect(f.zoom.testAudioDeviceHelper.stopMicTest).not.toHaveBeenCalled();
    await f.adapter.testMicrophone(true);
    await f.adapter.testMicrophone(false);
    expect(f.zoom.testAudioDeviceHelper.playMicTest).toHaveBeenCalledTimes(1);
  });
  it('maps chat, sharing, recording and web command events and removes all subscriptions', () => {
    const f = fixture(),
      receive = jest.fn();
    const disconnect = f.adapter.subscribe(receive);
    f.listeners.get('onChatNewMessageNotify')?.({
      messageID: 'm1',
      content: 'Hi',
      senderName: 'Student',
    });
    f.listeners.get('onUserShareStatusChanged')?.({
      user: { userId: '2' },
      shareAction: { shareStatus: 'ZoomVideoSDKShareStatus_Start' },
    });
    f.listeners.get('onCloudRecordingStatus')?.({
      status: 'ZoomVideoSDKRecordingStatus_Start',
    });
    f.listeners.get('onCommandReceived')?.({
      sender: 2,
      command: '{"type":"raise-hand","raised":true}',
    });
    expect(receive.mock.calls.map((call) => call[0].type)).toEqual([
      'chat',
      'share',
      'recording',
      'hand',
    ]);
    disconnect();
    const count = receive.mock.calls.length;
    f.listeners.get('onError')?.({ token: 'private' });
    expect(receive).toHaveBeenCalledTimes(count);
    expect(f.remove).toHaveBeenCalledTimes(f.listeners.size);
  });
});

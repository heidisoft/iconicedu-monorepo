import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { createZoomNativeAdapter, describeNativeError } from './zoom-native-adapter';
import type { useZoom } from '@zoom/react-native-videosdk';
jest.mock('@zoom/react-native-videosdk', () => ({
  Errors: { Success: 'ZoomVideoSDKError_Success' },
  ShareStatus: {
    Stop: 'ZoomVideoSDKShareStatus_Stop',
    None: 'ZoomVideoSDKShareStatus_None',
    Start: 'ZoomVideoSDKShareStatus_Start',
    Resume: 'ZoomVideoSDKShareStatus_Resume',
    Pause: 'ZoomVideoSDKShareStatus_Pause',
  },
  RecordingStatus: {
    Start: 'ZoomVideoSDKRecordingStatus_Start',
    Pause: 'ZoomVideoSDKRecordingStatus_Pause',
  },
  ConsentType: {
    ConsentType_Invalid: 'ConsentType_Invalid',
    ConsentType_Traditional: 'ConsentType_Traditional',
    ConsentType_Individual: 'ConsentType_Individual',
  },
  ZoomVideoSDKChatPrivilegeType: {
    ZoomVideoSDKChatPrivilege_No_One: 'ZoomVideoSDKChatPrivilege_No_One',
    ZoomVideoSDKChatPrivilege_Publicly: 'ZoomVideoSDKChatPrivilege_Publicly',
  },
  EventType: Object.fromEntries(
    [
      'onUserVideoNetworkStatusChanged',
      'onUserActiveAudioChanged',
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
      'onChatPrivilegeChanged',
      'onRequireSystemPermission',
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
      getCameraList: jest
        .fn()
        .mockResolvedValue([
          { deviceId: 'front', deviceName: 'Front camera', isSelectedDevice: true },
        ]),
      isMyVideoMirrored: jest.fn().mockResolvedValue(true),
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
      resumeCloudRecording: success(),
    },
    getRecordingConsentType: jest.fn().mockResolvedValue('ConsentType_Invalid'),
    acceptRecordingConsent: jest.fn().mockResolvedValue(true),
    declineRecordingConsent: jest.fn().mockResolvedValue(true),
    chatHelper: { sendChatToAll: success(), changeChatPrivilege: success() },
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
  NativeModules.ClassroomDevices = {
    getAudioRoutes: jest
      .fn()
      .mockResolvedValue([{ id: 'speaker', label: 'Speaker', selected: true }]),
    selectAudioRoute: jest.fn().mockResolvedValue(true),
  };
  NativeModules.ClassroomControls = {
    startMeetingService: jest.fn().mockResolvedValue(true),
    stopMeetingService: jest.fn().mockResolvedValue(true),
    startScreenShare: jest.fn().mockResolvedValue(true),
    claimHost: jest.fn().mockResolvedValue(true),
    stopShareService: jest.fn().mockResolvedValue(true),
    getShareMode: jest.fn().mockResolvedValue('single'),
    setShareMode: jest.fn().mockResolvedValue(true),
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
    expect(receive).toHaveBeenCalledWith({ type: 'recording', status: 'recording' });
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
  it('enumerates actual native devices and selects a camera exactly once', async () => {
    const f = fixture();
    await expect(f.adapter.devices!()).resolves.toEqual({
      cameras: [{ id: 'front', label: 'Front camera', selected: true }],
      mirrored: true,
      audio: [{ id: 'speaker', label: 'Speaker', selected: true }],
    });
    await f.adapter.selectCamera!('front');
    expect(f.zoom.videoHelper.switchCamera).toHaveBeenCalledTimes(1);
    expect(f.zoom.videoHelper.switchCamera).toHaveBeenCalledWith('front');
    await expect(f.adapter.selectCamera!('disconnected')).rejects.toThrow('disconnected');
    expect(f.zoom.videoHelper.switchCamera).toHaveBeenCalledTimes(1);
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
    await f.adapter.setShareMode!('multiple');
    expect(f.zoom.videoHelper.mirrorMyVideo).toHaveBeenCalledWith(true);
    expect(NativeModules.ClassroomControls.setShareMode).toHaveBeenCalledWith('multiple');
    await expect(f.adapter.shareMode!()).resolves.toBe('single');
  });
  it('rejects an unknown native share mode from an outdated binary', async () => {
    const f = fixture();
    NativeModules.ClassroomControls.getShareMode.mockResolvedValue(undefined);
    await expect(f.adapter.shareMode!()).rejects.toThrow('Update the app');
  });
  it('blocks a second presenter unless the host allows multiple presenters', async () => {
    const f = fixture();
    f.zoom.shareHelper.isOtherSharing.mockResolvedValue(true);
    const os = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      await expect(f.adapter.share(true)).rejects.toThrow('Another presenter is sharing');
      expect(f.zoom.shareHelper.shareScreen).not.toHaveBeenCalled();
      NativeModules.ClassroomControls.getShareMode.mockResolvedValue('multiple');
      await f.adapter.share(true);
      expect(f.zoom.shareHelper.shareScreen).toHaveBeenCalledTimes(1);
    } finally {
      os.restore();
    }
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
    await expect(f.adapter.share(true)).rejects.toThrow('Only the host can share');
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
  it('reports each presenter starting and stopping so simultaneous shares survive', () => {
    const f = fixture(),
      receive = jest.fn();
    f.adapter.subscribe(receive);
    const share = (userId: string, status: string) =>
      f.listeners.get('onUserShareStatusChanged')?.({
        user: { userId },
        shareAction: { shareStatus: `ZoomVideoSDKShareStatus_${status}` },
      });
    share('2', 'Start');
    share('3', 'Pause');
    share('2', 'Stop');
    share('4', 'None');
    expect(receive.mock.calls.map((call) => call[0])).toEqual([
      { type: 'share', userId: '2', active: true },
      { type: 'share', userId: '3', active: true },
      { type: 'share', userId: '2', active: false },
      { type: 'share', userId: '4', active: false },
    ]);
  });
  it('maps paused recording, consent requests and chat privilege changes', async () => {
    const f = fixture(),
      receive = jest.fn();
    f.adapter.subscribe(receive);
    f.listeners.get('onCloudRecordingStatus')?.({
      status: 'ZoomVideoSDKRecordingStatus_Pause',
    });
    f.zoom.getRecordingConsentType.mockResolvedValue('ConsentType_Individual');
    f.listeners.get('onCloudRecordingStatus')?.({
      status: 'ZoomVideoSDKRecordingStatus_Start',
    });
    f.listeners.get('onChatPrivilegeChanged')?.({
      privilege: 'ZoomVideoSDKChatPrivilege_No_One',
    });
    for (let index = 0; index < 5; index += 1) await Promise.resolve();
    expect(receive.mock.calls.map((call) => call[0])).toEqual([
      { type: 'recording', status: 'paused' },
      { type: 'recording', status: 'recording' },
      { type: 'chat-privilege', allowed: false },
      { type: 'recording-consent', consent: 'individual' },
    ]);
  });
  it.each([
    ['BySelf', 'self'],
    ['SessionLeaveReason_EndByHost', 'ended-by-host'],
    ['KickByHost', 'removed'],
    ['SessionLeaveReason_NetworkError', 'network'],
    [undefined, 'unknown'],
  ])('normalizes the %s leave reason from either platform', (reason, expected) => {
    const f = fixture(),
      receive = jest.fn();
    f.adapter.subscribe(receive);
    f.listeners.get('onSessionLeave')?.({ reason });
    expect(receive).toHaveBeenCalledWith({ type: 'left', reason: expected });
  });
  it('seeds presenters that were already sharing before this device joined', async () => {
    const f = fixture(),
      receive = jest.fn();
    f.zoom.session.getRemoteUsers.mockResolvedValue([
      { userId: '2', userName: 'Student', isHost: false, isManager: false },
    ]);
    const { ZoomVideoSdkUser } = jest.requireMock('@zoom/react-native-videosdk');
    const original = ZoomVideoSdkUser.getMockImplementation();
    ZoomVideoSdkUser.mockImplementation((value: Record<string, unknown>) => ({
      ...value,
      getUserName: async () => value.userName,
      getIsHost: async () => value.isHost,
      getIsManager: async () => value.isManager,
      audioStatus: { isMuted: async () => true },
      videoStatus: { isOn: async () => false },
      getShareActionList: async () =>
        value.userId === '2' ? [{ shareStatus: 'ZoomVideoSDKShareStatus_Start' }] : [],
    }));
    f.adapter.subscribe(receive);
    f.listeners.get('onSessionJoin')?.();
    for (let index = 0; index < 30; index += 1) await Promise.resolve();
    expect(receive).toHaveBeenCalledWith({ type: 'share', userId: '2', active: true });
    ZoomVideoSdkUser.mockImplementation(original);
  });
  it('resumes recording, answers consent and restricts chat through the SDK', async () => {
    const f = fixture();
    await f.adapter.resumeRecording!();
    await f.adapter.recordingConsent!(false);
    await f.adapter.chatPrivilege!(false);
    expect(f.zoom.recordingHelper.resumeCloudRecording).toHaveBeenCalled();
    expect(f.zoom.declineRecordingConsent).toHaveBeenCalled();
    expect(f.zoom.chatHelper.changeChatPrivilege).toHaveBeenCalledWith(
      'ZoomVideoSDKChatPrivilege_No_One',
    );
    f.zoom.acceptRecordingConsent.mockResolvedValue(false);
    await expect(f.adapter.recordingConsent!(true)).rejects.toThrow('recording choice');
  });
  it.each([
    ['ZoomVideoSDKError_JoinSession_Invalid_SessionToken', 'classroom pass has expired'],
    ['ZoomVideoSDKError_Auth_Error', 'classroom pass has expired'],
    ['ZoomVideoSDKError_Session_Audio_No_Microphone', 'No microphone'],
    ['ZoomVideoSDKError_Session_Video_Device_Error', 'camera stopped working'],
    ['ZoomVideoSDKError_Session_Share_Error', 'Screen sharing stopped'],
    ['ZoomVideoSDKError_Not_In_Session', 'not connected'],
    ['something_new', 'connection or device error'],
  ])('describes %s without exposing the SDK code', (type, message) => {
    expect(describeNativeError(type)).toContain(message);
    expect(describeNativeError(type)).not.toContain('ZoomVideoSDK');
  });
  it('turns SDK errors and permission loss into actionable events', () => {
    const f = fixture(),
      receive = jest.fn();
    f.adapter.subscribe(receive);
    f.listeners.get('onError')?.({ errorType: 'ZoomVideoSDKError_Session_Reconnecting' });
    f.listeners.get('onError')?.({
      errorType: 'ZoomVideoSDKError_Permission_RECORD_AUDIO',
    });
    f.listeners.get('onRequireSystemPermission')?.({
      permissionType: 'ZoomVideoSDKSystemPermissionType_Camera',
    });
    f.listeners.get('onError')?.({ errorType: 'ZoomVideoSDKError_Session_Share_Error' });
    expect(receive.mock.calls.map((call) => call[0])).toEqual([
      { type: 'permission', device: 'microphone' },
      { type: 'permission', device: 'camera' },
      { type: 'error', message: 'Screen sharing stopped working. Try sharing again.' },
    ]);
  });
  it('ignores network status until Zoom has measured the connection', async () => {
    const f = fixture(),
      receive = jest.fn();
    f.adapter.subscribe(receive);
    f.listeners.get('onSessionJoin')?.();
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
    receive.mockClear();
    const status = (value: string) =>
      f.listeners.get('onUserVideoNetworkStatusChanged')?.({
        status: `ZoomVideoSDKNetwork_${value}`,
        user: { userId: '1' },
      });
    status('None');
    status('Bad');
    status('Good');
    expect(receive.mock.calls.map((call) => call[0])).toEqual([
      { type: 'network', level: 'bad' },
      { type: 'network', level: 'good' },
    ]);
  });
});

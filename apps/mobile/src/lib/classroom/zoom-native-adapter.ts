import { createNativePictureInPicture } from './native-picture-in-picture';
import {
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import {
  ConsentType,
  EventType,
  Errors,
  RecordingStatus,
  ShareStatus,
  ZoomVideoSDKChatPrivilegeType,
  ZoomVideoSdkUser,
  useZoom,
} from '@zoom/react-native-videosdk';
import type {
  NativeLeaveReason,
  NativeMeetingAdapter,
  NativeMeetingEvent,
  NativeParticipant,
  NativeMediaDevice,
  NativeRecordingStatus,
  NativeShareMode,
} from './meeting-controller';

type Zoom = ReturnType<typeof useZoom>;
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const recordingStatus = (status: unknown): NativeRecordingStatus =>
  status === RecordingStatus.Start
    ? 'recording'
    : status === RecordingStatus.Pause
      ? 'paused'
      : 'stopped';
// iOS sends the bare reason ("EndByHost"); Android prefixes it ("SessionLeaveReason_EndByHost").
const leaveReason = (reason: unknown): NativeLeaveReason => {
  const value = String(reason ?? '');
  if (value.endsWith('BySelf')) return 'self';
  if (value.endsWith('EndByHost')) return 'ended-by-host';
  if (value.endsWith('KickByHost')) return 'removed';
  if (value.endsWith('NetworkError')) return 'network';
  return 'unknown';
};
// Same intent as web's describeZoomFailure: tell people what to do next, never raw SDK codes.
const NATIVE_ERRORS: Array<[RegExp, string]> = [
  [
    /^Auth|JoinSession_(Invalid_SessionToken|Token)/,
    'Your classroom pass has expired. Leave and join the class again.',
  ],
  [
    /Session_No_Rights|Fail_Assign_User_Privilege/,
    'You do not have permission for that action.',
  ],
  [/No_License/, 'This classroom has reached its plan limits. Ask the host for help.'],
  [
    /Audio_No_Microphone|Permission_RECORD_AUDIO/,
    'No microphone is available. Allow microphone access or join without audio.',
  ],
  [/Audio/, 'Classroom audio stopped working. Check your microphone and speaker.'],
  [/Share/, 'Screen sharing stopped working. Try sharing again.'],
  [/Video|Camera/, 'Your camera stopped working. Turn your camera off and on again.'],
  [
    /Not_In_Session|Session_Disconnecting|Session_Join_Failed|Session_Not_Started/,
    'You are not connected to the classroom. Check your connection and rejoin.',
  ],
];
export function describeNativeError(errorType: unknown) {
  // Strip the shared prefix, which itself contains "Video".
  const type = String(errorType ?? '').replace(/^ZoomVideoSDKError_/, '');
  return (
    NATIVE_ERRORS.find(([pattern]) => pattern.test(type))?.[1] ??
    'The meeting encountered a connection or device error. Please retry.'
  );
}
// Zoom reports chat time in seconds on some platforms; normalise to milliseconds.
const chatTime = (value: unknown) => {
  const time = Number(value);
  if (!Number.isFinite(time) || time <= 0) return Date.now();
  return time < 1e12 ? time * 1000 : time;
};
const sharing = (status: unknown) =>
  status === ShareStatus.Start ||
  status === ShareStatus.Resume ||
  status === ShareStatus.Pause;
function checked(result: unknown) {
  if (result != null && result !== Errors.Success && result !== 0 && result !== true)
    throw new Error('Zoom could not complete this action');
}
/** Only this adapter depends on Zoom's bridge/event payloads. Never log credentials. */
export function createZoomNativeAdapter(zoom: Zoom): NativeMeetingAdapter {
  const pictureInPicture = createNativePictureInPicture();
  let generation = 0;
  let handRaised = false;
  let selfId: string | null = null;
  let awaitingJoin = false;
  let startJoinRecovery: (() => void) | null = null;
  let microphoneTest = false;
  let microphonePlayback = false;
  let speakerTest = false;
  return {
    pictureInPicture,
    subscribe(listener) {
      const current = ++generation;
      let refreshEpoch = 0;
      const compositions = new Map<string, ReturnType<typeof setTimeout>>();
      let joinedPending = false;
      let didJoin = false;
      let joinRecovery: ReturnType<typeof setInterval> | null = null;
      const send = (event: NativeMeetingEvent) => {
        if (generation === current) listener(event);
      };
      const refresh = async (joined = false) => {
        const request = ++refreshEpoch;
        if (joined) joinedPending = true;
        try {
          const self = await zoom.session.getMySelf();
          const users = [self, ...(await zoom.session.getRemoteUsers())];
          const participants: NativeParticipant[] = await Promise.all(
            users.map(async (value) => {
              const user = new ZoomVideoSdkUser(value);
              return {
                id: user.userId,
                name: await user.getUserName(),
                host: await user.getIsHost(),
                cohost: await user.getIsManager(),
                muted: await user.audioStatus.isMuted(),
                video: await user.videoStatus.isOn(),
              };
            }),
          );
          const joining = joinedPending;
          if (request !== refreshEpoch || generation !== current) return;
          selfId = self.userId;
          send(
            joinedPending
              ? { type: 'joined', selfId: self.userId, participants }
              : { type: 'participants', participants },
          );
          joinedPending = false;
          if (joining) {
            didJoin = true;
            awaitingJoin = false;
            if (joinRecovery) clearInterval(joinRecovery);
            joinRecovery = null;
            void NativeModules.ClassroomControls.startMeetingService().catch(() =>
              send({
                type: 'error',
                message: 'Keep the app open to continue classroom audio.',
              }),
            );
            void zoom.cmdChannel
              .sendCommand('', JSON.stringify({ type: 'raise-hand-state-request' }))
              .catch(() => {});
            // Ancillary SDK helpers can stall on a cold iOS session. Entry is already confirmed.
            void zoom.recordingHelper
              .getCloudRecordingStatus()
              .then((status) => {
                if (generation === current)
                  send({ type: 'recording', status: recordingStatus(status) });
              })
              .catch(() => {});
            void Promise.all(
              users.map(async (value) => {
                const user = new ZoomVideoSdkUser(value);
                const actions: Array<{ shareStatus?: unknown }> = await Promise.resolve(
                  user.getShareActionList?.() ?? [],
                ).catch(() => []);
                if (
                  generation === current &&
                  actions.some((action) => sharing(action.shareStatus))
                )
                  send({ type: 'share', userId: value.userId, active: true });
              }),
            ).catch(() => {});
          }
        } catch {
          // The first native event can arrive before the user helpers are ready.
          // Reconciliation retries this during join; the controller owns the deadline.
          if (!awaitingJoin)
            send({
              type: 'error',
              message: 'Unable to update participants. Please reconnect.',
            });
        }
      };
      const subscriptions = [
        zoom.addListener(EventType.onUserActiveAudioChanged, (value: unknown) => {
          const users = object(value).changedUsers;
          if (Array.isArray(users))
            send({
              type: 'speaking',
              userIds: users
                .map((user) => object(user).userId)
                .filter((id): id is string => typeof id === 'string'),
            });
        }),
        zoom.addListener(EventType.onUserVideoNetworkStatusChanged, (value: unknown) => {
          const event = object(value),
            user = object(event.user);
          if (String(user.userId) !== selfId || typeof event.status !== 'string') return;
          // "None" means Zoom has no measurement yet, not a good connection.
          const level = event.status.endsWith('_Bad')
            ? 'bad'
            : event.status.endsWith('_Normal')
              ? 'normal'
              : event.status.endsWith('_Good')
                ? 'good'
                : null;
          if (level) send({ type: 'network', level });
        }),
        zoom.addListener(EventType.onOriginalLanguageMsgReceived, (value: unknown) => {
          const info = object(object(value).messageInfo);
          if (typeof info.messageContent === 'string')
            send({ type: 'caption', text: info.messageContent });
        }),
        zoom.addListener(EventType.onCommandReceived, (value: unknown) => {
          const event = object(value);
          if (typeof event.command !== 'string') return;
          const userId = String(event.sender ?? '');
          if (!/^\d+$/.test(userId)) return;
          try {
            const command = object(JSON.parse(event.command));
            if (command.type === 'raise-hand' && typeof command.raised === 'boolean')
              send({ type: 'hand', userId, raised: command.raised });
            else if (command.type === 'raise-hand-state-request' && handRaised)
              void zoom.cmdChannel.sendCommand(
                '',
                JSON.stringify({ type: 'raise-hand', raised: true }),
              );
            else if (
              command.type === 'meeting-composited-share-v1' &&
              typeof command.active === 'boolean'
            ) {
              const previous = compositions.get(userId);
              if (previous) clearTimeout(previous);
              if (command.active)
                compositions.set(
                  userId,
                  setTimeout(() => {
                    compositions.delete(userId);
                    send({ type: 'composition', userId, active: false });
                  }, 6000),
                );
              else compositions.delete(userId);
              send({ type: 'composition', userId, active: command.active });
            } else if (
              command.type === 'reaction' &&
              typeof command.emoji === 'string' &&
              command.emoji.length <= 16
            )
              send({ type: 'reaction', userId, emoji: command.emoji });
          } catch {
            /* Ignore commands from incompatible clients. */
          }
        }),
        zoom.addListener(EventType.onSessionJoin, () => {
          void refresh(!didJoin);
        }),
        zoom.addListener(EventType.onSessionLeave, (value: unknown) => {
          send({ type: 'left', reason: leaveReason(object(value).reason) });
          void NativeModules.ClassroomControls.stopMeetingService().catch(() => {});
          void NativeModules.ClassroomControls.stopShareService().catch(() => {});
        }),
        ...[
          EventType.onUserJoin,
          EventType.onUserLeave,
          EventType.onUserHostChanged,
          EventType.onUserManagerChanged,
          EventType.onUserAudioStatusChanged,
          EventType.onUserVideoStatusChanged,
          EventType.onUserNameChanged,
        ].map((event) =>
          zoom.addListener(event, () => {
            void refresh();
          }),
        ),
        zoom.addListener(EventType.onError, (value: unknown) => {
          const errorType = String(object(value).errorType ?? '');
          // Failover is reported through onUserFailoverStatusChanged.
          if (errorType.endsWith('Session_Reconnecting')) return;
          // Android reports revoked microphone access as an error, not a permission event.
          if (errorType.endsWith('Permission_RECORD_AUDIO'))
            send({ type: 'permission', device: 'microphone' });
          else send({ type: 'error', message: describeNativeError(errorType) });
        }),
        zoom.addListener(EventType.onRequireSystemPermission, (value: unknown) => {
          const type = String(object(value).permissionType ?? '');
          if (type.endsWith('_Camera')) send({ type: 'permission', device: 'camera' });
          else if (type.endsWith('_Microphone'))
            send({ type: 'permission', device: 'microphone' });
        }),
        zoom.addListener(EventType.onUserShareStatusChanged, (value: unknown) => {
          const event = object(value),
            action = object(event.shareAction),
            user = object(event.user);
          if (typeof user.userId === 'string')
            send({
              type: 'share',
              userId: user.userId,
              active: sharing(action.shareStatus),
            });
        }),
        zoom.addListener(EventType.onCloudRecordingStatus, (value: unknown) => {
          const status = recordingStatus(object(value).status);
          send({ type: 'recording', status });
          if (status !== 'recording') return;
          // Zoom only holds a consent handler for participants who must answer.
          void zoom
            .getRecordingConsentType()
            .then((type) => {
              if (type === ConsentType.ConsentType_Traditional)
                send({ type: 'recording-consent', consent: 'traditional' });
              else if (type === ConsentType.ConsentType_Individual)
                send({ type: 'recording-consent', consent: 'individual' });
            })
            .catch(() => {});
        }),
        zoom.addListener(EventType.onChatPrivilegeChanged, (value: unknown) =>
          send({
            type: 'chat-privilege',
            allowed:
              object(value).privilege !==
              ZoomVideoSDKChatPrivilegeType.ZoomVideoSDKChatPrivilege_No_One,
          }),
        ),
        zoom.addListener(EventType.onChatNewMessageNotify, (value: unknown) => {
          const message = object(value),
            sender = object(message.senderUser);
          if (
            typeof message.content === 'string' &&
            typeof message.messageID === 'string'
          )
            send({
              type: 'chat',
              id: message.messageID,
              sender: String(sender.userName ?? message.senderName ?? 'Participant'),
              text: message.content,
              self: message.isSelfSend === true,
              sentAt: chatTime(message.timestamp),
            });
        }),
        zoom.addListener(EventType.onUserFailoverStatusChanged, (value: unknown) => {
          const user = object(object(value).user);
          void zoom.session
            .getMySelf()
            .then((self) => {
              if (self.userId === user.userId)
                send({
                  type: 'connection',
                  reconnecting: object(value).isInFailover === true,
                });
            })
            .catch(() => {});
        }),
      ];
      // iOS only: the native module resets Zoom's audio session when the interruption ends.
      const interruptions =
        Platform.OS === 'ios' && NativeModules.ClassroomControls?.addListener
          ? new NativeEventEmitter(NativeModules.ClassroomControls).addListener(
              'ClassroomAudioInterrupted',
              (value: unknown) =>
                send({
                  type: 'audio-interrupted',
                  active: object(value).active === true,
                }),
            )
          : null;
      let reconciling = false;
      startJoinRecovery = () => {
        if (joinRecovery) return;
        joinRecovery = setInterval(() => {
          if (!awaitingJoin || reconciling || generation !== current || didJoin) return;
          reconciling = true;
          void zoom
            .isInSession()
            .then(async (connected) => {
              if (connected && awaitingJoin && generation === current && !didJoin)
                await refresh(true);
            })
            .catch(() => {})
            .finally(() => {
              reconciling = false;
            });
        }, 500);
      };
      return () => {
        if (joinRecovery) clearInterval(joinRecovery);
        compositions.forEach(clearTimeout);
        compositions.clear();
        startJoinRecovery = null;
        awaitingJoin = false;
        ++generation;
        subscriptions.forEach((subscription) => subscription.remove());
        interruptions?.remove();
      };
    },
    async prepareAudio() {
      if (Platform.OS === 'android' && Number(Platform.Version) >= 31) {
        const permission = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT;
        if (!(await PermissionsAndroid.check(permission))) {
          // Denial leaves device audio available; the OS controls access to headsets.
          await PermissionsAndroid.request(permission);
        }
      }
    },
    async join(credentials, options) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      awaitingJoin = true;
      startJoinRecovery?.();
      await zoom.joinSession({
        sessionName: credentials.sessionName,
        userName: credentials.displayName,
        token: credentials.token,
        sessionIdleTimeoutMins: 40,
        audioOptions: {
          connect: true,
          mute: !options.microphone,
          autoAdjustSpeakerVolume: true,
        },
        videoOptions: { localVideoOn: options.camera },
      });
    },
    async leave(endForAll) {
      awaitingJoin = false;
      await pictureInPicture?.configure('', false, false).catch(() => {});
      // The wrapper drops this native promise; await the bridge so failures stay recoverable.
      checked(await NativeModules.RNZoomVideoSdk.leaveSession(endForAll));
      await NativeModules.ClassroomControls.stopShareService();
      await NativeModules.ClassroomControls.stopMeetingService();
    },
    async microphone(id, enabled) {
      checked(
        await (enabled
          ? zoom.audioHelper.unmuteAudio(id)
          : zoom.audioHelper.muteAudio(id)),
      );
    },
    async removeParticipant(id) {
      checked(await zoom.userHelper.removeUser(id));
    },
    async camera(enabled) {
      checked(
        await (enabled ? zoom.videoHelper.startVideo() : zoom.videoHelper.stopVideo()),
      );
    },
    async devices() {
      const [cameras, mirrored, audio, microphones] = await Promise.all([
        zoom.videoHelper.getCameraList(),
        zoom.videoHelper.isMyVideoMirrored(),
        NativeModules.ClassroomDevices?.getAudioRoutes() ?? Promise.resolve([]),
        NativeModules.ClassroomDevices?.getAudioInputs?.() ?? Promise.resolve(null),
      ]);
      return {
        cameras: cameras.map((device) => ({
          id: device.deviceId,
          label: device.deviceName,
          selected: device.isSelectedDevice,
        })),
        mirrored,
        audio: audio as NativeMediaDevice[],
        microphones: (microphones ??
          (audio as NativeMediaDevice[]).map((device) => ({
            ...device,
            label: ['Speaker', 'Earpiece'].includes(device.label)
              ? `Built-in microphone (${device.label.toLowerCase()})`
              : device.label === 'MicrophoneBuiltIn'
                ? 'Built-in microphone'
                : device.label,
          }))) as NativeMediaDevice[],
        microphoneRouting: microphones ? 'independent' : 'linked',
      };
    },
    async selectCamera(id) {
      const cameras = await zoom.videoHelper.getCameraList();
      if (!cameras.some((device) => device.deviceId === id))
        throw new Error('This camera disconnected. Choose another camera.');
      checked(await zoom.videoHelper.switchCamera(id));
    },
    async selectAudioRoute(id) {
      if (!NativeModules.ClassroomDevices)
        throw new Error('Update the app to select audio devices.');
      if (Platform.OS === 'ios') checked(await zoom.audioHelper.setSDKAudioSessionEnv());
      if (Platform.OS === 'android' && Number(Platform.Version) >= 31)
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        );
      checked(await NativeModules.ClassroomDevices.selectAudioRoute(id));
    },
    async selectMicrophone(id) {
      if (NativeModules.ClassroomDevices?.selectAudioInput) {
        if (Platform.OS === 'ios')
          checked(await zoom.audioHelper.setSDKAudioSessionEnv());
        checked(await NativeModules.ClassroomDevices.selectAudioInput(id));
      } else {
        if (!NativeModules.ClassroomDevices?.selectAudioRoute)
          throw new Error('Update the app to select audio devices.');
        if (Platform.OS === 'ios')
          checked(await zoom.audioHelper.setSDKAudioSessionEnv());
        if (Platform.OS === 'android' && Number(Platform.Version) >= 31)
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          );
        checked(await NativeModules.ClassroomDevices.selectAudioRoute(id));
      }
    },
    async switchCamera() {
      checked(await zoom.videoHelper.switchCamera());
    },
    async mirror(enabled) {
      checked(await zoom.videoHelper.mirrorMyVideo(enabled));
    },
    async startWhiteboardShare(tag) {
      if (!NativeModules.ClassroomControls.startWhiteboardShare)
        throw new Error('Update the app to publish whiteboards.');
      checked(await NativeModules.ClassroomControls.startWhiteboardShare(tag));
    },
    async compositionStatus() {
      return !!(await NativeModules.ClassroomControls.compositionStatus?.());
    },
    async announceComposition(active) {
      checked(
        await zoom.cmdChannel.sendCommand(
          '',
          JSON.stringify({ type: 'meeting-composited-share-v1', active }),
        ),
      );
    },
    async shareMode() {
      const mode: unknown = await NativeModules.ClassroomControls.getShareMode();
      if (mode === 'locked' || mode === 'single' || mode === 'multiple') return mode;
      throw new Error('Update the app to change sharing.');
    },
    async setShareMode(mode: NativeShareMode) {
      checked(await NativeModules.ClassroomControls.setShareMode(mode));
    },
    async share(enabled) {
      const lockedForParticipant =
        enabled &&
        (await zoom.shareHelper.isShareLocked()) &&
        !(await new ZoomVideoSdkUser(await zoom.session.getMySelf()).getIsHost());
      if (lockedForParticipant)
        throw new Error('Only the host can share while sharing is locked.');
      const multiple =
        enabled &&
        (await NativeModules.ClassroomControls.getShareMode?.().catch(() => null)) ===
          'multiple';
      if (enabled && !multiple && (await zoom.shareHelper.isOtherSharing()))
        throw new Error(
          'Another presenter is sharing. Ask the host to allow multiple presenters.',
        );
      checked(
        await (enabled
          ? Platform.OS === 'ios'
            ? NativeModules.ClassroomControls.startScreenShare()
            : zoom.shareHelper.shareScreen()
          : zoom.shareHelper.stopShare()),
      );
      if (!enabled) await NativeModules.ClassroomControls.stopShareService();
    },
    async cohost(id, enabled) {
      checked(
        await (enabled
          ? zoom.userHelper.makeManager(id)
          : zoom.userHelper.revokeManager(id)),
      );
    },
    async command(payload) {
      checked(await zoom.cmdChannel.sendCommand('', JSON.stringify(payload)));
      if (payload.type === 'raise-hand') handRaised = payload.raised;
    },
    async captions(enabled) {
      if (enabled) {
        if (await zoom.liveTranscriptionHelper.canStartLiveTranscription())
          checked(await zoom.liveTranscriptionHelper.startLiveTranscription());
        checked(
          await zoom.liveTranscriptionHelper.enableReceiveSpokenLanguageContent(true),
        );
      } else
        checked(
          await zoom.liveTranscriptionHelper.enableReceiveSpokenLanguageContent(false),
        );
    },
    async claimHost() {
      checked(await NativeModules.ClassroomControls.claimHost());
    },
    async host(id) {
      checked(await zoom.userHelper.makeHost(id));
    },
    async recording(enabled) {
      if (enabled) {
        const result = await zoom.recordingHelper.canStartRecording();
        if (result !== Errors.Success && result !== 0)
          throw new Error(
            'Cloud recording is unavailable. Ask the host to check recording permissions.',
          );
      }
      checked(
        await (enabled
          ? zoom.recordingHelper.startCloudRecording()
          : zoom.recordingHelper.stopCloudRecording()),
      );
    },
    async joinChime() {
      await NativeModules.ClassroomControls.playJoinChime?.();
    },
    async pauseRecording() {
      checked(await zoom.recordingHelper.pauseCloudRecording());
    },
    async resumeRecording() {
      checked(await zoom.recordingHelper.resumeCloudRecording());
    },
    async recordingConsent(accept) {
      if (
        !(await (accept ? zoom.acceptRecordingConsent() : zoom.declineRecordingConsent()))
      )
        throw new Error('Zoom could not record your recording choice. Please retry.');
    },
    async chatPrivilege(allowed) {
      checked(
        await zoom.chatHelper.changeChatPrivilege(
          allowed
            ? ZoomVideoSDKChatPrivilegeType.ZoomVideoSDKChatPrivilege_Publicly
            : ZoomVideoSDKChatPrivilegeType.ZoomVideoSDKChatPrivilege_No_One,
        ),
      );
    },
    async chat(text) {
      checked(await zoom.chatHelper.sendChatToAll(text));
    },
    async speaker(enabled) {
      checked(await zoom.audioHelper.setSpeaker(enabled));
    },
    async background(mode, filePath) {
      if (!(await zoom.virtualBackgroundHelper.isSupportVirtualBackground()))
        throw new Error('This device does not support background effects.');
      if (mode === 'image' && filePath) {
        const item = object(
          await zoom.virtualBackgroundHelper.addVirtualBackgroundItem(filePath),
        );
        if (typeof item.imageName !== 'string')
          throw new Error('Unable to load this background image.');
        checked(
          await zoom.virtualBackgroundHelper.setVirtualBackgroundItem(item.imageName),
        );
        return;
      }
      const items: unknown =
        await zoom.virtualBackgroundHelper.getVirtualBackgroundItemList();
      // The wrapper enum has mislabeled values; native iOS/Android return the SDK's actual names.
      const item = Array.isArray(items)
        ? items
            .map((value: unknown) => object(value))
            .find(
              (value) =>
                String(value.type) ===
                `ZoomVideoSDKVirtualBackgroundDataType_${mode === 'blur' ? 'Blur' : 'None'}`,
            )
        : undefined;
      if (!item || typeof item.imageName !== 'string')
        throw new Error('This background effect is unavailable on this device.');
      checked(
        await zoom.virtualBackgroundHelper.setVirtualBackgroundItem(item.imageName),
      );
    },
    async originalAudio(enabled) {
      checked(await zoom.audioSettingHelper.enableMicOriginalInput(enabled));
    },
    async stopAudioTests() {
      if (microphoneTest || microphonePlayback) {
        const result = await zoom.testAudioDeviceHelper.stopMicTest();
        if (result !== 'ZoomVideoSDKError_Wrong_Usage') checked(result);
        microphonePlayback = false;
        microphoneTest = false;
      }
      if (speakerTest) {
        checked(await zoom.testAudioDeviceHelper.stopSpeakerTest());
        speakerTest = false;
      }
    },
    async testSpeaker(enabled) {
      if (enabled === speakerTest) return;
      checked(
        await (enabled
          ? zoom.testAudioDeviceHelper.startSpeakerTest()
          : zoom.testAudioDeviceHelper.stopSpeakerTest()),
      );
      speakerTest = enabled;
    },
    async testMicrophone(enabled) {
      if (enabled === microphoneTest) return;
      checked(
        await (enabled
          ? zoom.testAudioDeviceHelper.startMicTest()
          : zoom.testAudioDeviceHelper.stopMicTest()),
      );
      microphoneTest = enabled;
      if (!enabled) {
        checked(await zoom.testAudioDeviceHelper.playMicTest());
        microphonePlayback = true;
      }
    },
  };
}

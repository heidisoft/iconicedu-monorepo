import { createNativePictureInPicture } from './native-picture-in-picture';
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import {
  EventType,
  Errors,
  RecordingStatus,
  ShareStatus,
  ZoomVideoSdkUser,
  useZoom,
} from '@zoom/react-native-videosdk';
import type {
  NativeMeetingAdapter,
  NativeMeetingEvent,
  NativeParticipant,
  NativeMediaDevice,
} from './meeting-controller';

type Zoom = ReturnType<typeof useZoom>;
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
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
  let microphoneTest = false;
  let microphonePlayback = false;
  let speakerTest = false;
  return {
    pictureInPicture,
    subscribe(listener) {
      const current = ++generation;
      let refreshEpoch = 0;
      let joinedPending = false;
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
          const recordingStatus = joining
            ? await zoom.recordingHelper.getCloudRecordingStatus().catch(() => undefined)
            : undefined;
          if (request !== refreshEpoch || generation !== current) return;
          selfId = self.userId;
          send(
            joinedPending
              ? { type: 'joined', selfId: self.userId, participants }
              : { type: 'participants', participants },
          );
          joinedPending = false;
          if (recordingStatus !== undefined)
            send({
              type: 'recording',
              active: recordingStatus === RecordingStatus.Start,
            });
        } catch {
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
          if (String(user.userId) === selfId && typeof event.status === 'string')
            send({
              type: 'network',
              level: event.status.endsWith('_Bad')
                ? 'bad'
                : event.status.endsWith('_Normal')
                  ? 'normal'
                  : 'good',
            });
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
            )
              send({ type: 'composition', userId, active: command.active });
            else if (
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
          void refresh(true);
          void NativeModules.ClassroomControls.startMeetingService().catch(() =>
            send({
              type: 'error',
              message: 'Keep the app open to continue classroom audio.',
            }),
          );
          void zoom.cmdChannel
            .sendCommand('', JSON.stringify({ type: 'raise-hand-state-request' }))
            .catch(() => {});
        }),
        zoom.addListener(EventType.onSessionLeave, (value: unknown) => {
          send({ type: 'left', reason: String(object(value).reason ?? '') });
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
        zoom.addListener(EventType.onError, () =>
          send({
            type: 'error',
            message:
              'The meeting encountered a connection or device error. Please retry.',
          }),
        ),
        zoom.addListener(EventType.onUserShareStatusChanged, (value: unknown) => {
          const event = object(value),
            action = object(event.shareAction),
            user = object(event.user);
          send({
            type: 'share',
            userId:
              action.shareStatus === ShareStatus.Stop ||
              action.shareStatus === ShareStatus.None
                ? null
                : typeof user.userId === 'string'
                  ? user.userId
                  : null,
          });
        }),
        zoom.addListener(EventType.onCloudRecordingStatus, (value: unknown) =>
          send({
            type: 'recording',
            active: object(value).status === RecordingStatus.Start,
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
      return () => {
        ++generation;
        subscriptions.forEach((subscription) => subscription.remove());
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
    async camera(enabled) {
      checked(
        await (enabled ? zoom.videoHelper.startVideo() : zoom.videoHelper.stopVideo()),
      );
    },
    async devices() {
      const [cameras, mirrored, audio] = await Promise.all([
        zoom.videoHelper.getCameraList(),
        zoom.videoHelper.isMyVideoMirrored(),
        NativeModules.ClassroomDevices?.getAudioRoutes() ?? Promise.resolve([]),
      ]);
      return {
        cameras: cameras.map((device) => ({
          id: device.deviceId,
          label: device.deviceName,
          selected: device.isSelectedDevice,
        })),
        mirrored,
        audio: audio as NativeMediaDevice[],
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
    async switchCamera() {
      checked(await zoom.videoHelper.switchCamera());
    },
    async mirror(enabled) {
      checked(await zoom.videoHelper.mirrorMyVideo(enabled));
    },
    async lockSharing(locked) {
      checked(await zoom.shareHelper.lockShare(locked));
    },
    async share(enabled) {
      const lockedForParticipant =
        enabled &&
        (await zoom.shareHelper.isShareLocked()) &&
        !(await new ZoomVideoSdkUser(await zoom.session.getMySelf()).getIsHost());
      if (enabled && ((await zoom.shareHelper.isOtherSharing()) || lockedForParticipant))
        throw new Error(
          'Screen sharing is unavailable while another presenter is sharing or sharing is locked.',
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
      checked(
        await (enabled
          ? zoom.recordingHelper.startCloudRecording()
          : zoom.recordingHelper.stopCloudRecording()),
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

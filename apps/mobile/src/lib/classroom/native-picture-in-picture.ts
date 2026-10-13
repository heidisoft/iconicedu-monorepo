import { NativeEventEmitter, NativeModules } from 'react-native';
export interface NativePictureInPictureAdapter {
  supported(): Promise<boolean>;
  configure(userId: string, sharing: boolean, automatic: boolean): Promise<void>;
  enter(): Promise<void>;
  subscribe(listener: (active: boolean) => void): () => void;
}
export function createNativePictureInPicture():
  | NativePictureInPictureAdapter
  | undefined {
  const bridge = NativeModules.ClassroomPictureInPicture;
  if (!bridge) return undefined;
  return {
    supported: () => bridge.isSupported(),
    configure: async (id, sharing, automatic) => {
      await bridge.configure(id, sharing, automatic);
    },
    enter: async () => {
      await bridge.enter();
    },
    subscribe: (listener) => {
      const subscription = new NativeEventEmitter(bridge).addListener(
        'ClassroomPiPChanged',
        (event: unknown) => {
          if (
            event &&
            typeof event === 'object' &&
            'active' in event &&
            typeof event.active === 'boolean'
          )
            listener(event.active);
        },
      );
      return () => subscription.remove();
    },
  };
}

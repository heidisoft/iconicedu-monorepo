import { useEffect } from 'react';
import type {
  NativeMeetingAdapter,
  NativeMeetingController,
  NativeMeetingState,
} from '@/lib/classroom/meeting-controller';

/** Announce only frames actually composed by the native publisher, never a UI toggle. */
export function useNativeRecordingComposition(
  adapter: NativeMeetingAdapter,
  controller: NativeMeetingController,
  state: NativeMeetingState,
) {
  useEffect(() => {
    if (!state.recording || state.recordingPaused) return;
    const missing = state.sharingUserIds.filter((id) => !state.composited.includes(id));
    if (!missing.length) return;
    const timer = setTimeout(() => {
      for (const id of missing) controller.composition(id, false, true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [
    controller,
    state.recording,
    state.recordingPaused,
    state.sharingUserIds,
    state.composited,
  ]);
  useEffect(() => {
    if (state.phase !== 'meeting' && state.phase !== 'reconnecting') return;
    if (!adapter.compositionStatus || !adapter.announceComposition) return;
    let active = true;
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const composed = await adapter.compositionStatus!();
        if (!active) return;
        await adapter.announceComposition!(composed);
        const current = controller.snapshot();
        if (current.selfId) controller.composition(current.selfId, composed);
      } catch {
        if (active && controller.snapshot().selfId)
          controller.composition(controller.snapshot().selfId!, false);
      } finally {
        busy = false;
      }
    };
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 1000);
    return () => {
      active = false;
      clearInterval(timer);
      void adapter.announceComposition!(false).catch(() => {});
    };
  }, [adapter, controller, state.phase]);
}

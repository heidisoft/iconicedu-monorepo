import type { BackgroundPreset } from './zoom-video-session.types';

export const MIRROR_VIDEO_STORAGE_KEY = 'iconicedu:zoom-session:mirror-video';
export const REACTION_EMOJIS = ['👍', '👏', '🎉', '❤️', '😂'] as const;
export const TOOLBAR_ACTION_CLASS = 'shrink-0 snap-start [&_svg]:size-5';

export const BACKGROUND_PRESETS: Array<{
  value: Exclude<BackgroundPreset, 'none' | 'blur'>;
  label: string;
  src: string;
}> = [
  {
    value: 'classroom',
    label: 'Classroom',
    src: '/live-session-backgrounds/classroom.svg',
  },
  { value: 'study', label: 'Study', src: '/live-session-backgrounds/study.svg' },
];

export const ANNOTATION_COLORS: Array<{ label: string; value: number }> = [
  { label: 'Red', value: 0xffff0000 },
  { label: 'Yellow', value: 0xffffd60a },
  { label: 'Green', value: 0xff22c55e },
  { label: 'Blue', value: 0xff3b82f6 },
  { label: 'Black', value: 0xff000000 },
];

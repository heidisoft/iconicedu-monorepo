import type { BackgroundPreset } from './zoom-video-session.types';

export const MIRROR_VIDEO_STORAGE_KEY = 'iconicedu:zoom-session:mirror-video';
export const REACTION_EMOJIS = ['👍', '👏', '🎉', '❤️', '😂'] as const;
export const MEETING_TOOLBAR_ICON_CLASS = '[&_svg]:size-5 [&_svg]:stroke-2';
export const TOOLBAR_ACTION_CLASS = `shrink-0 snap-start ${MEETING_TOOLBAR_ICON_CLASS}`;

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

export const LEARNING_SPACE_ICON_KEYS = [
  'sparkles',
  'square-pi',
  'languages',
  'chef-hat',
  'earth',
  'chess-knight',
  'palette',
  'paintbrush',
  'scissors',
  'calculator',
  'ruler',
  'pen-tool',
  'notebook-pen',
  'notebook-text',
  'clipboard-check',
  'graduation-cap',
  'landmark',
  'map',
] as const;

export type LearningSpaceIconKey = (typeof LEARNING_SPACE_ICON_KEYS)[number];

export const DEFAULT_LEARNING_SPACE_ICON_KEY: LearningSpaceIconKey = 'sparkles';

export const LEARNING_SPACE_ICON_OPTIONS: Array<{
  value: LearningSpaceIconKey;
  label: string;
}> = [
  { value: 'sparkles', label: 'Sparkles' },
  { value: 'square-pi', label: 'Math' },
  { value: 'languages', label: 'Languages' },
  { value: 'chef-hat', label: 'Creative' },
  { value: 'earth', label: 'World' },
  { value: 'chess-knight', label: 'Chess' },
  { value: 'palette', label: 'Arts Palette' },
  { value: 'paintbrush', label: 'Arts Brush' },
  { value: 'scissors', label: 'Arts Scissors' },
  { value: 'calculator', label: 'Math Calculator' },
  { value: 'ruler', label: 'Math Ruler' },
  { value: 'pen-tool', label: 'ELA Pen' },
  { value: 'notebook-pen', label: 'ELA Notebook' },
  { value: 'notebook-text', label: 'Homework Notebook' },
  { value: 'clipboard-check', label: 'Homework Checklist' },
  { value: 'graduation-cap', label: 'SHSAT / SAT' },
  { value: 'landmark', label: 'Social Studies Landmark' },
  { value: 'map', label: 'Social Studies Map' },
];

export function isLearningSpaceIconKey(value: string): value is LearningSpaceIconKey {
  return (LEARNING_SPACE_ICON_KEYS as readonly string[]).includes(value);
}

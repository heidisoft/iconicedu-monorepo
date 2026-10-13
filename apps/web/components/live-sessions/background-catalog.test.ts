import { expect, it } from 'vitest';
import { buildBackgroundCatalog } from './background-catalog';

it('discovers public photos once, excluding resolution aliases and nested files', () => {
  expect(
    buildBackgroundCatalog([
      './Room.jpg',
      './Room.jpg',
      './Desk.png',
      './apps/web/public/live-session-backgrounds/Room.jpg',
      './nested/Other.jpg',
      './notes.txt',
    ]),
  ).toEqual([
    { value: 'image:Desk.png', label: 'Desk', src: '/live-session-backgrounds/Desk.png' },
    { value: 'image:Room.jpg', label: 'Room', src: '/live-session-backgrounds/Room.jpg' },
  ]);
});

it('encodes public filenames and gives camera-library filenames short labels', () => {
  expect(
    buildBackgroundCatalog(['./My Room.webp', './pexels-dada-12277130.jpg']),
  ).toEqual([
    {
      value: 'image:My Room.webp',
      label: 'My Room',
      src: '/live-session-backgrounds/My%20Room.webp',
    },
    {
      value: 'image:pexels-dada-12277130.jpg',
      label: 'Background 2',
      src: '/live-session-backgrounds/pexels-dada-12277130.jpg',
    },
  ]);
});

import { expect, it } from 'vitest';
import { buildMeetingBackgroundCatalog } from './background-catalog';

it('names photos the same way for directory-context keys and bundled filenames', () => {
  const expected = [
    { value: 'image:Desk.png', label: 'Desk', filename: 'Desk.png' },
    { value: 'image:Room.jpg', label: 'Room', filename: 'Room.jpg' },
    {
      value: 'image:pexels-dada-12277130.jpg',
      label: 'Background 3',
      filename: 'pexels-dada-12277130.jpg',
    },
  ];
  expect(
    buildMeetingBackgroundCatalog([
      './Room.jpg',
      './Room.jpg',
      './Desk.png',
      './pexels-dada-12277130.jpg',
      './nested/Other.jpg',
      './notes.txt',
    ]),
  ).toEqual(expected);
  expect(
    buildMeetingBackgroundCatalog(['pexels-dada-12277130.jpg', 'Room.jpg', 'Desk.png']),
  ).toEqual(expected);
});

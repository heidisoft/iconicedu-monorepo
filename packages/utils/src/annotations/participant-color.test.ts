import { describe, expect, it } from 'vitest';
import { participantColor } from './participant-color';
describe('participant annotation colors', () => {
  it('assigns distinct colors even beyond the preset palette', () => {
    const ids = Array.from({ length: 64 }, (_, i) => `participant-${i}`);
    const colors = ids.map((id) => participantColor(id, ids));
    expect(new Set(colors).size).toBe(ids.length);
    expect(colors.every((color) => /^#[0-9a-f]{6}$/i.test(color))).toBe(true);
  });
  it('agrees across viewers regardless of roster order or duplicate identities', () => {
    const ids = ['teacher', 'guest', 'student'];
    expect(participantColor('guest', ids)).toBe(
      participantColor('guest', [...ids].reverse()),
    );
    expect(participantColor('guest', ids)).toBe(
      participantColor('guest', [...ids, 'guest']),
    );
  });
});

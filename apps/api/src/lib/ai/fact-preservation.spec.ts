import { checkFactPreservation } from './fact-preservation';

describe('checkFactPreservation', () => {
  it('passes when there are no facts to preserve', () => {
    expect(checkFactPreservation('hello there', 'hi there!')).toEqual({
      preserved: true,
      missing: [],
    });
  });

  it('passes when a mention, url, amount, date, and time all survive the rewrite', () => {
    const original =
      'Hi @Jane Smith, please see https://example.com/permission-slip, the $25 fee is due 3/14 at 5:00pm.';
    const revised =
      'Hello @Jane Smith — kindly review https://example.com/permission-slip. The $25 fee is due on 3/14 at 5:00pm, thank you!';
    expect(checkFactPreservation(original, revised)).toEqual({
      preserved: true,
      missing: [],
    });
  });

  it('flags a dropped mention', () => {
    const original = 'Thanks @Jane Smith for the update';
    const revised = 'Thanks for the update';
    const result = checkFactPreservation(original, revised);
    expect(result.preserved).toBe(false);
    expect(result.missing).toContain('@Jane Smith');
  });

  it('flags a dropped amount', () => {
    const original = 'The trip costs $45.50 per student';
    const revised = 'The trip has a cost per student';
    const result = checkFactPreservation(original, revised);
    expect(result.preserved).toBe(false);
    expect(result.missing).toContain('$45.50');
  });

  it('flags a dropped date and time together', () => {
    const original = 'See you 3/14 at 5:00pm';
    const revised = 'See you soon';
    const result = checkFactPreservation(original, revised);
    expect(result.preserved).toBe(false);
    expect(result.missing).toEqual(expect.arrayContaining(['3/14', '5:00pm']));
  });

  it('is case- and whitespace-insensitive when matching', () => {
    const original = 'Visit HTTPS://Example.com/Slip';
    const revised = 'please visit    https://Example.com/Slip   today';
    expect(checkFactPreservation(original, revised).preserved).toBe(true);
  });
});

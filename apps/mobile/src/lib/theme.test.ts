import { darkColors, lightColors } from './theme';

describe('mobile theme tokens', () => {
  it('uses a deep pine action color on warm off-white surfaces', () => {
    expect(lightColors).toMatchObject({
      pageBg: '#f5f6f1',
      card: '#ffffff',
      primary: '#2f7d4a',
      primaryForeground: '#ffffff',
      primarySubtle: '#e2f0e2',
      action: '#25493c',
      actionForeground: '#ffffff',
      actionSubtle: '#e7efe9',
      ink: '#1f2a26',
      inkForeground: '#ffffff',
      tabActive: '#25493c',
    });
  });

  it('lifts the greens for legibility on dark surfaces', () => {
    expect(darkColors).toMatchObject({
      primary: '#5fb17e',
      primaryForeground: '#08241a',
      action: '#6fae8a',
      actionForeground: '#0e241c',
      ink: '#f3f5f0',
      inkForeground: '#1f2a26',
      tabActive: '#fafafa',
    });
  });

  it('exposes semantic status tokens so components never hardcode a status hue', () => {
    for (const scheme of [lightColors, darkColors]) {
      expect(typeof scheme.success).toBe('string');
      expect(typeof scheme.successForeground).toBe('string');
      expect(typeof scheme.warning).toBe('string');
      expect(typeof scheme.info).toBe('string');
    }
  });

  it('exposes decorative pastel tiles with matching foregrounds', () => {
    for (const scheme of [lightColors, darkColors]) {
      for (const key of ['pink', 'peach', 'periwinkle', 'lime'] as const) {
        expect(typeof scheme[key]).toBe('string');
        expect(typeof scheme[`${key}Fg`]).toBe('string');
      }
    }
  });

  it('repoints legacy teal aliases onto the pine action tokens', () => {
    expect(lightColors.teal).toBe(lightColors.action);
    expect(lightColors.tealFg).toBe(lightColors.actionForeground);
    expect(lightColors.tealBg).toBe(lightColors.actionSubtle);
    expect(darkColors.teal).toBe(darkColors.action);
    expect(darkColors.tealFg).toBe(darkColors.actionForeground);
    expect(darkColors.tealBg).toBe(darkColors.actionSubtle);
  });
});

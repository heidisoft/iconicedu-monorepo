import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ZoomCaptions } from './zoom-captions';
it('retains the live region as captions arrive and expire', () => {
  const { rerender } = render(<ZoomCaptions text="" />);
  const region = screen.getByRole('status');
  expect(region.getAttribute('aria-live')).toBe('polite');
  expect(region.getAttribute('aria-atomic')).toBe('true');
  rerender(<ZoomCaptions text="Lesson caption" />);
  expect(screen.getByRole('status')).toBe(region);
  expect(region.textContent).toBe('Lesson caption');
  rerender(<ZoomCaptions text="" />);
  expect(screen.getByRole('status')).toBe(region);
});

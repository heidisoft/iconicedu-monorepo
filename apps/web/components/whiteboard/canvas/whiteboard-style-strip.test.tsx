import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DrawingStyleStrip } from '@iconicedu/ui-web/ui/drawing-style-strip';
it('shows the current custom color and sends native style choices', () => {
  const onStyle = vi.fn();
  const onMore = vi.fn();
  render(
    <DrawingStyleStrip
      color="#123456"
      width={2}
      fill="transparent"
      showWidth
      showFill
      optionsOpen={false}
      onStyle={onStyle}
      onMore={onMore}
    />,
  );
  expect(
    screen
      .getByRole('button', { name: 'Stroke color #123456' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Thick stroke' }));
  expect(onStyle).toHaveBeenLastCalledWith({ strokeWidth: 4 });
  fireEvent.click(screen.getByRole('button', { name: 'Fill shape' }));
  expect(onStyle).toHaveBeenLastCalledWith({ backgroundColor: '#123456' });
  fireEvent.click(screen.getByRole('button', { name: 'More style options' }));
  expect(onMore).toHaveBeenCalledOnce();
});

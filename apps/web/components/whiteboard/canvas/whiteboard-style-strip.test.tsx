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

it('closes and reopens the picker without changing the selected tool style', () => {
  const onClose = vi.fn(),
    onStyle = vi.fn();
  render(
    <DrawingStyleStrip
      color="#123456"
      width={2}
      fill="transparent"
      showWidth
      showFill
      optionsOpen={false}
      onMore={vi.fn()}
      onStyle={onStyle}
      onClose={onClose}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Close drawing styles' }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button', { name: 'Stroke color #123456' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Show drawing styles' }));
  expect(screen.getByRole('button', { name: 'Stroke color #123456' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(onStyle).not.toHaveBeenCalled();
});

it('preserves palette order while highlighting the picked color', () => {
  const props = {
    color: '#e03131',
    width: 2,
    fill: 'transparent',
    showWidth: true,
    showFill: true,
    optionsOpen: false,
    onStyle: vi.fn(),
    onMore: vi.fn(),
  };
  const view = render(<DrawingStyleStrip {...props} />);
  const order = () =>
    screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'))
      .filter((label) => label?.startsWith('Stroke color'));
  const before = order();
  view.rerender(<DrawingStyleStrip {...props} color="#1971c2" />);
  expect(order()).toEqual(before);
  expect(screen.getByRole('button', { name: 'Stroke color #1971c2' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

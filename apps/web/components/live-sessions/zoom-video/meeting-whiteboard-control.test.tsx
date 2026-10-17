import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { TooltipProvider } from '@iconicedu/ui-web/ui/tooltip';
import { MeetingWhiteboardControl } from './meeting-whiteboard-control';

it.each([true, false])(
  'stops directly when authorized, with visibility %s',
  async (visible) => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    const onToggle = vi.fn();
    render(
      <TooltipProvider>
        <MeetingWhiteboardControl
          visible={visible}
          presenting
          canStop
          onStop={onStop}
          onToggle={onToggle}
        />
      </TooltipProvider>,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Stop presenting whiteboard' }));
    expect(onStop).toHaveBeenCalledOnce();
    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  },
);
it('opens directly when the whiteboard is closed', async () => {
  const user = userEvent.setup();
  const onToggle = vi.fn();
  render(
    <TooltipProvider>
      <MeetingWhiteboardControl
        visible={false}
        presenting={false}
        canStop={false}
        onStop={vi.fn()}
        onToggle={onToggle}
      />
    </TooltipProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Open whiteboard' }));
  expect(onToggle).toHaveBeenCalledOnce();
});
it('does not hide the board or grant viewers permission to stop it', async () => {
  const user = userEvent.setup();
  const onToggle = vi.fn();
  const onStop = vi.fn();
  render(
    <TooltipProvider>
      <MeetingWhiteboardControl
        visible
        presenting={false}
        canStop={false}
        onStop={onStop}
        onToggle={onToggle}
      />
    </TooltipProvider>,
  );
  const button = screen.getByRole('button', { name: 'Whiteboard is being presented' });
  expect(button).toBeDisabled();
  await user.click(button);
  expect(onToggle).not.toHaveBeenCalled();
  expect(onStop).not.toHaveBeenCalled();
  expect(screen.queryByRole('menu')).toBeNull();
});

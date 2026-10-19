import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { TooltipProvider } from '@iconicedu/ui-web/ui/tooltip';
import { MeetingWhiteboardControl } from './meeting-whiteboard-control';

it('allows anyone to start an inactive whiteboard', async () => {
  const onToggle = vi.fn();
  render(
    <TooltipProvider>
      <MeetingWhiteboardControl
        visible={false}
        presenting={false}
        canStop={false}
        onToggle={onToggle}
        onStop={vi.fn()}
      />
    </TooltipProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Start whiteboard' }));
  expect(onToggle).toHaveBeenCalledOnce();
});
it.each([true, false])(
  'offers local visibility and owner-only stop (owner %s)',
  async (owner) => {
    const onToggle = vi.fn(),
      onStop = vi.fn();
    render(
      <TooltipProvider>
        <MeetingWhiteboardControl
          visible
          presenting={owner}
          canStop={owner}
          onToggle={onToggle}
          onStop={onStop}
        />
      </TooltipProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Whiteboard options' }));
    expect(
      screen.queryByRole('menuitem', { name: 'Stop sharing for everyone' }) !== null,
    ).toBe(owner);
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Hide whiteboard for me' }),
    );
    expect(onToggle).toHaveBeenCalledOnce();
    expect(onStop).not.toHaveBeenCalled();
    if (owner) {
      await userEvent.click(screen.getByRole('button', { name: 'Whiteboard options' }));
      await userEvent.click(
        screen.getByRole('menuitem', { name: 'Stop sharing for everyone' }),
      );
      expect(onStop).toHaveBeenCalledOnce();
    }
  },
);
it('reopens a locally hidden presentation without starting another one', async () => {
  const onToggle = vi.fn();
  render(
    <TooltipProvider>
      <MeetingWhiteboardControl
        active
        visible={false}
        presenting={false}
        canStop={false}
        onToggle={onToggle}
        onStop={vi.fn()}
      />
    </TooltipProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Whiteboard options' }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'Show whiteboard' }));
  expect(onToggle).toHaveBeenCalledOnce();
});

it('disables starting a whiteboard while screen sharing is active', async () => {
  const onToggle = vi.fn();
  render(
    <TooltipProvider>
      <MeetingWhiteboardControl
        visible={false}
        presenting={false}
        canStop={false}
        disabled
        onToggle={onToggle}
        onStop={vi.fn()}
      />
    </TooltipProvider>,
  );
  expect(screen.getByRole('button', { name: 'Start whiteboard' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Start whiteboard' }));
  expect(onToggle).not.toHaveBeenCalled();
});

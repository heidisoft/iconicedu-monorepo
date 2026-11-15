import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Share } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { IconActionButton } from './icon-action-button';
import { TooltipProvider } from './tooltip';

describe('IconActionButton', () => {
  it('provides a tooltip from its accessible action label and forwards clicks and refs', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(
      <TooltipProvider>
        <IconActionButton label="Share meeting link" ref={ref} onClick={onClick}>
          <Share />
        </IconActionButton>
      </TooltipProvider>,
    );
    const button = screen.getByRole('button', { name: 'Share meeting link' });
    expect(ref.current).toBe(button);
    await user.hover(button);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Share meeting link');
    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
  it('provides a keyboard-accessible explanation for a disabled action', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <TooltipProvider>
        <IconActionButton
          label="Share screen"
          tooltip="End the whiteboard to share your screen"
          disabled
          onClick={onClick}
        >
          <Share />
        </IconActionButton>
      </TooltipProvider>,
    );
    expect(screen.getByRole('button', { name: 'Share screen' })).toBeDisabled();
    await user.tab();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'End the whiteboard to share your screen',
    );
    expect(onClick).not.toHaveBeenCalled();
  });
  it('preserves toggle state and opens its tooltip on keyboard focus', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <IconActionButton label="Lower hand" aria-pressed>
          <Share />
        </IconActionButton>
      </TooltipProvider>,
    );
    expect(screen.getByRole('button', { name: 'Lower hand' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.tab();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Lower hand');
  });
  it('preserves submit behavior for icon actions inside forms', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event) => event.preventDefault());
    render(
      <TooltipProvider>
        <form onSubmit={onSubmit}>
          <IconActionButton label="Send message" type="submit">
            <Share />
          </IconActionButton>
        </form>
      </TooltipProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});

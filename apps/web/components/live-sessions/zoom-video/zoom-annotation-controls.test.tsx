import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@iconicedu/ui-web/ui/tooltip';
import { ZoomAnnotationControls } from './zoom-annotation-controls';

describe('ZoomAnnotationControls', () => {
  it('keeps a single pencil toggle when annotation starts and stops', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const view = render(
      <TooltipProvider>
        <ZoomAnnotationControls available isAnnotating={false} onToggle={onToggle} />
      </TooltipProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Annotate shared screen' }));
    expect(onToggle).toHaveBeenCalledOnce();
    view.rerender(
      <TooltipProvider>
        <ZoomAnnotationControls available isAnnotating onToggle={onToggle} />
      </TooltipProvider>,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(
      screen.queryByRole('toolbar', { name: 'Annotation tools' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop annotating' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Stop annotating' }));
    expect(onToggle).toHaveBeenCalledTimes(2);
  });
  it('disables duplicate clicks while starting', () => {
    render(
      <TooltipProvider>
        <ZoomAnnotationControls
          available
          isAnnotating={false}
          pending
          onToggle={vi.fn()}
        />
      </TooltipProvider>,
    );
    expect(screen.getByRole('button', { name: 'Annotate shared screen' })).toBeDisabled();
  });
  it('hides annotation when no eligible shared screen is available', () => {
    render(
      <ZoomAnnotationControls
        available={false}
        isAnnotating={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

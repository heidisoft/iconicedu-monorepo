import { AnnotationToolType } from '@zoom/videosdk';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@iconicedu/ui-web/ui/tooltip';
import { ZoomAnnotationControls } from './zoom-annotation-controls';

describe('ZoomAnnotationControls', () => {
  it('starts annotation from the floating pencil control', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();

    render(
      <TooltipProvider>
        <ZoomAnnotationControls
          available
          isAnnotating={false}
          selectedTool={AnnotationToolType.Pen}
          onStart={onStart}
          onSelectTool={vi.fn()}
          onSelectColor={vi.fn()}
          onUndo={vi.fn()}
          onRedo={vi.fn()}
          onClear={vi.fn()}
          onClose={vi.fn()}
        />
      </TooltipProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Annotate shared screen' }));
    expect(onStart).toHaveBeenCalledWith();
  });

  it('places the pencil in a safe bottom-left dock above the meeting controls', () => {
    render(
      <TooltipProvider>
        <ZoomAnnotationControls
          available
          isAnnotating={false}
          selectedTool={AnnotationToolType.Pen}
          onStart={vi.fn()}
          onSelectTool={vi.fn()}
          onSelectColor={vi.fn()}
          onUndo={vi.fn()}
          onRedo={vi.fn()}
          onClear={vi.fn()}
          onClose={vi.fn()}
        />
      </TooltipProvider>,
    );

    const dock = screen.getByRole('button', {
      name: 'Annotate shared screen',
    }).parentElement;

    expect(dock).toHaveClass('left-4', 'sm:left-6');
    expect(dock).toHaveStyle({
      bottom: 'calc(max(1.5rem, env(safe-area-inset-bottom)) + 4.75rem)',
    });
  });
});

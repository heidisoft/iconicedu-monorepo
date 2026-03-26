import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog';

describe('Dialog', () => {
  it('uses the larger desktop default max width', () => {
    render(
      <Dialog open onOpenChange={() => undefined}>
        <DialogContent>
          <DialogTitle>Test dialog</DialogTitle>
          <DialogDescription>Dialog description</DialogDescription>
          <div>Body</div>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole('dialog')).toHaveClass('sm:max-w-[42rem]');
  });

  it('closes when Escape is pressed', async () => {
    function DialogHarness() {
      const [open, setOpen] = React.useState(true);

      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogTitle>Dismissible dialog</DialogTitle>
            <DialogDescription>Dialog description</DialogDescription>
            <div>Body</div>
          </DialogContent>
        </Dialog>
      );
    }

    render(<DialogHarness />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

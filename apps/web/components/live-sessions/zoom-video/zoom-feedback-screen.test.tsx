import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ZoomFeedbackScreen } from './zoom-feedback-screen';

describe('ZoomFeedbackScreen', () => {
  it('selects a rating and exposes submit and skip actions', async () => {
    const user = userEvent.setup();
    const onRatingChange = vi.fn();
    const onSkip = vi.fn();

    render(
      <ZoomFeedbackScreen
        rating={null}
        isSubmitting={false}
        onRatingChange={onRatingChange}
        onSubmit={vi.fn()}
        onSkip={onSkip}
      />,
    );

    expect(screen.getAllByRole('radio')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'Great' }));
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onRatingChange).toHaveBeenCalledWith(5);
    expect(onSkip).toHaveBeenCalledOnce();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MessageTextContent } from './message-text-content';

describe('MessageTextContent', () => {
  it('renders mentions as a single styled token', async () => {
    const { container } = render(
      <MessageTextContent
        text="Hello @Taylor Reed there"
        mentions={[{ profileId: 'profile-1', displayName: 'Taylor Reed', start: 6, end: 18 }]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('@Taylor Reed')).toBeInTheDocument();
    });

    const mention = screen.getByText('@Taylor Reed');
    expect(mention.tagName).toBe('SPAN');
    expect(mention.className).toContain('bg-sky-100');
    expect(mention.className).toContain('dark:bg-sky-500/20');
    expect(mention.className).toContain('dark:text-sky-100');
    expect(container.textContent).toBe('Hello @Taylor Reed there');
  });
});

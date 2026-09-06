import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MessageTextContent } from './message-text-content';

describe('MessageTextContent', () => {
  it('renders mentions as a single styled token', async () => {
    const { container } = render(
      <MessageTextContent
        text="Hello @Taylor Reed there"
        mentions={[
          { profileId: 'profile-1', displayName: 'Taylor Reed', start: 6, end: 18 },
        ]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('@Taylor Reed')).toBeInTheDocument();
    });

    const mention = screen.getByText('@Taylor Reed');
    expect(mention.tagName).toBe('SPAN');
    expect(mention.className).toContain('bg-action-subtle');
    expect(mention.className).toContain('text-action');
    expect(mention.className).toContain('ring-action/25');
    expect(container.textContent).toBe('Hello @Taylor Reed there');
  });

  it('renders bold and italic text markers as formatted content', async () => {
    render(<MessageTextContent text="This is **bold** and *italic* text" />);

    await waitFor(() => {
      expect(screen.getByText('bold').closest('strong')).toBeInTheDocument();
      expect(screen.getByText('italic').closest('em')).toBeInTheDocument();
    });
  });

  it('renders URLs as clickable links', async () => {
    render(<MessageTextContent text="Open https://example.com/docs." />);

    const link = await screen.findByRole('link', {
      name: 'https://example.com/docs',
    });
    expect(link).toHaveAttribute('href', 'https://example.com/docs');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByText('.')).toBeInTheDocument();
  });
});

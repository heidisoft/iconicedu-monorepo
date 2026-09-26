import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MessageTextContent } from './message-text-content';

describe('MessageTextContent', () => {
  it('uses mobile-sized readable text and wraps long unbroken content', () => {
    const text = 'A'.repeat(200);
    const { container } = render(<MessageTextContent text={text} />);

    expect(container.querySelector('p')).toHaveClass(
      'text-[15px]',
      'leading-5',
      'whitespace-pre-wrap',
      '[overflow-wrap:anywhere]',
    );
    expect(container.textContent).toBe(text);
  });

  it('keeps emoji-only messages large', () => {
    const { container } = render(<MessageTextContent text="😀" />);

    expect(container.querySelector('p')).toHaveClass('text-4xl', 'leading-tight');
    expect(container.querySelector('p')).not.toHaveClass('text-[15px]', 'leading-5');
  });

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

  describe('list formatting (enableMessageListFormatting)', () => {
    const listText = 'Shopping list:\n- milk\n- eggs\n- bread';

    it('renders bullet-prefixed lines as a plain paragraph when the flag is off', () => {
      const { container } = render(
        <MessageTextContent text={listText} enableListFormatting={false} />,
      );

      expect(container.querySelector('ul')).not.toBeInTheDocument();
      expect(container.querySelector('p')).toBeInTheDocument();
      expect(container.textContent).toBe(listText);
    });

    it('renders consecutive bullet lines as a <ul> when the flag is on', () => {
      const { container } = render(
        <MessageTextContent text={listText} enableListFormatting />,
      );

      const list = container.querySelector('ul');
      expect(list).toBeInTheDocument();
      expect(list).toHaveClass('list-disc');
      const items = container.querySelectorAll('li');
      expect(items).toHaveLength(3);
      expect(items[0]).toHaveTextContent('milk');
      expect(items[1]).toHaveTextContent('eggs');
      expect(items[2]).toHaveTextContent('bread');
      expect(container.textContent).toContain('Shopping list:');
    });

    it('renders consecutive numbered lines as an <ol> when the flag is on', () => {
      const { container } = render(
        <MessageTextContent
          text={'1. First\n2. Second\n3. Third'}
          enableListFormatting
        />,
      );

      const list = container.querySelector('ol');
      expect(list).toBeInTheDocument();
      expect(list).toHaveClass('list-decimal');
      expect(container.querySelectorAll('li')).toHaveLength(3);
    });

    it('still renders plain paragraphs when the flag is on but there are no list markers', () => {
      const { container } = render(
        <MessageTextContent text="Just a normal message" enableListFormatting />,
      );

      expect(container.querySelector('ul')).not.toBeInTheDocument();
      expect(container.querySelector('ol')).not.toBeInTheDocument();
      expect(container.querySelector('p')).toBeInTheDocument();
    });

    it('formats mentions inside list items using offsets relative to the item', async () => {
      const text = '- @Taylor Reed please review\n- ok';
      const { container } = render(
        <MessageTextContent
          text={text}
          enableListFormatting
          mentions={[
            { profileId: 'profile-1', displayName: 'Taylor Reed', start: 2, end: 14 },
          ]}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('@Taylor Reed')).toBeInTheDocument();
      });
      expect(container.querySelectorAll('li')).toHaveLength(2);
    });
  });
});

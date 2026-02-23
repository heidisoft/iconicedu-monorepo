import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { MessageInput } from './message-input';

describe('MessageInput', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls onTypingStart and onTypingStop as content changes', () => {
    vi.useFakeTimers();
    const onTypingStart = vi.fn();
    const onTypingStop = vi.fn();
    render(
      <MessageInput onSend={vi.fn()} onTypingStart={onTypingStart} onTypingStop={onTypingStop} />,
    );

    const textarea = screen.getByPlaceholderText('Write a message...');
    fireEvent.change(textarea, { target: { value: 'Hello' } });

    expect(onTypingStart).toHaveBeenCalledTimes(1);
    expect(onTypingStop).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onTypingStop).toHaveBeenCalledTimes(1);
  });

  it('stops typing when content is cleared', () => {
    const onTypingStart = vi.fn();
    const onTypingStop = vi.fn();
    render(
      <MessageInput onSend={vi.fn()} onTypingStart={onTypingStart} onTypingStop={onTypingStop} />,
    );

    const textarea = screen.getByPlaceholderText('Write a message...');
    fireEvent.change(textarea, { target: { value: 'Typing' } });
    fireEvent.change(textarea, { target: { value: '' } });

    expect(onTypingStart).toHaveBeenCalledTimes(1);
    expect(onTypingStop).toHaveBeenCalledTimes(1);
  });

  it('calls onFocus when textarea receives focus', () => {
    const onFocus = vi.fn();
    render(<MessageInput onSend={vi.fn()} onFocus={onFocus} />);

    fireEvent.focus(screen.getByPlaceholderText('Write a message...'));

    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('calls onInputKeyDown when user presses a key in textarea', () => {
    const onInputKeyDown = vi.fn();
    render(<MessageInput onSend={vi.fn()} onInputKeyDown={onInputKeyDown} />);

    fireEvent.keyDown(screen.getByPlaceholderText('Write a message...'), {
      key: 'a',
      code: 'KeyA',
    });

    expect(onInputKeyDown).toHaveBeenCalledTimes(1);
  });

  it('does not send in read-only mode', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} readOnly />);

    const textarea = screen.getByPlaceholderText('Write a message...');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('shows loading state and prevents send while loading', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} isLoading />);

    const textarea = screen.getByPlaceholderText('Write a message...');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sending...' }));

    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled();
  });
});

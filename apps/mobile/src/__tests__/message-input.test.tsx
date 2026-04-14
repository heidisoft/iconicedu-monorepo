import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { MessageInput } from '@/components/messages/message-input';

function getInputHeightProp(input: ReturnType<typeof screen.getByLabelText>) {
  const style = Array.isArray(input.props.style)
    ? input.props.style
    : [input.props.style];
  return style.find((entry) => entry && typeof entry === 'object' && 'height' in entry)
    ?.height;
}

describe('MessageInput', () => {
  it('renders input field', () => {
    render(<MessageInput onSend={jest.fn()} />);
    expect(screen.getByLabelText('Message input')).toBeTruthy();
  });

  it('renders send button', () => {
    render(<MessageInput onSend={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText('Message input'), 'Hello');
    expect(screen.getByLabelText('Send message')).toBeTruthy();
  });

  it('calls onSend with text when send button is pressed', () => {
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);

    fireEvent.changeText(screen.getByLabelText('Message input'), 'Hello');
    fireEvent.press(screen.getByLabelText('Send message'));

    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('clears input after sending', () => {
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);

    const input = screen.getByLabelText('Message input');
    fireEvent.changeText(input, 'Hello');
    fireEvent.press(screen.getByLabelText('Send message'));

    expect(input.props.value).toBe('');
  });

  it('resets the multiline input height after sending', () => {
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);

    const input = screen.getByLabelText('Message input');

    fireEvent.changeText(input, 'Hello\nworld\nagain');
    fireEvent(input, 'contentSizeChange', {
      nativeEvent: { contentSize: { height: 72 } },
    });

    expect(getInputHeightProp(input)).toBe(72);

    fireEvent.press(screen.getByLabelText('Send message'));

    expect(input.props.value).toBe('');
    expect(getInputHeightProp(input)).toBe(20);
  });

  it('does not send empty messages', () => {
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);

    expect(screen.queryByLabelText('Send message')).toBeNull();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('does not send whitespace-only messages', () => {
    const onSend = jest.fn();
    render(<MessageInput onSend={onSend} />);

    fireEvent.changeText(screen.getByLabelText('Message input'), '   ');
    expect(screen.queryByLabelText('Send message')).toBeNull();

    expect(onSend).not.toHaveBeenCalled();
  });

  it('renders custom placeholder', () => {
    render(<MessageInput onSend={jest.fn()} placeholder="Write something..." />);
    expect(screen.getByPlaceholderText('Write something...')).toBeTruthy();
  });

  it('truncates long placeholder text after 25 characters', () => {
    render(
      <MessageInput
        onSend={jest.fn()}
        placeholder="This placeholder should truncate after twenty five characters"
      />,
    );

    expect(screen.getByPlaceholderText('This placeholder should t...')).toBeTruthy();
  });
});

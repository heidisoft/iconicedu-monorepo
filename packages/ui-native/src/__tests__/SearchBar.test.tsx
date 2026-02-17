import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SearchBar } from '../components/SearchBar';

describe('SearchBar', () => {
  it('renders with placeholder', () => {
    render(
      <SearchBar value="" onChangeText={jest.fn()} placeholder="Search..." />,
    );
    expect(screen.getByPlaceholderText('Search...')).toBeTruthy();
  });

  it('calls onChangeText when typing', () => {
    const onChangeText = jest.fn();
    render(
      <SearchBar
        value=""
        onChangeText={onChangeText}
        placeholder="Search..."
      />,
    );
    fireEvent.changeText(screen.getByPlaceholderText('Search...'), 'test');
    expect(onChangeText).toHaveBeenCalledWith('test');
  });

  it('shows clear button when value is not empty', () => {
    render(
      <SearchBar value="test" onChangeText={jest.fn()} />,
    );
    expect(screen.getByLabelText('Clear search')).toBeTruthy();
  });

  it('clears value when clear button pressed', () => {
    const onChangeText = jest.fn();
    render(
      <SearchBar value="test" onChangeText={onChangeText} />,
    );
    fireEvent.press(screen.getByLabelText('Clear search'));
    expect(onChangeText).toHaveBeenCalledWith('');
  });

  it('does not show clear button when value is empty', () => {
    render(
      <SearchBar value="" onChangeText={jest.fn()} />,
    );
    expect(screen.queryByLabelText('Clear search')).toBeNull();
  });
});

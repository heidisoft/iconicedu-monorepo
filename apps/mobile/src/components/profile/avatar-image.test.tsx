import React from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';

import { AvatarImage } from './avatar-image';
import { clearAvatarUriCache } from '@/lib/profile-avatar-url';

const mockCreateSignedUrl = jest.fn();
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    storage: { from: jest.fn(() => ({ createSignedUrl: mockCreateSignedUrl })) },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  clearAvatarUriCache();
});

it('signs an uploaded avatar path before rendering it', async () => {
  mockCreateSignedUrl.mockResolvedValue({
    data: { signedUrl: 'https://signed.example.invalid/photo.jpg' },
    error: null,
  });
  render(<AvatarImage uri="org/profile/photo.jpg" accessibilityLabel="Jane" />);
  const image = await screen.findByLabelText('Jane');
  expect(image.props.source).toEqual({ uri: 'https://signed.example.invalid/photo.jpg' });
  expect(mockCreateSignedUrl).toHaveBeenCalledWith('org/profile/photo.jpg', 3600);
});

it('renders external URLs directly', () => {
  render(
    <AvatarImage uri="https://images.example.invalid/p.jpg" accessibilityLabel="Ext" />,
  );
  expect(screen.getByLabelText('Ext').props.source).toEqual({
    uri: 'https://images.example.invalid/p.jpg',
  });
  expect(mockCreateSignedUrl).not.toHaveBeenCalled();
});

it('shows the fallback when the photo cannot be signed', async () => {
  mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: 'missing' } });
  render(<AvatarImage uri="org/profile/gone.jpg" fallback={<Text>JT</Text>} />);
  await waitFor(() => expect(screen.getByText('JT')).toBeTruthy());
});

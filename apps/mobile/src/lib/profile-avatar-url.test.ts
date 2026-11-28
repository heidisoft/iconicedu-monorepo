import {
  avatarStoragePath,
  clearAvatarUriCache,
  peekAvatarUri,
  resolveAvatarUri,
} from './profile-avatar-url';

beforeEach(() => clearAvatarUriCache());

describe('avatarStoragePath', () => {
  it('treats a bare value as a private storage path', () => {
    expect(avatarStoragePath('org/profile/1700-abc.jpg')).toBe(
      'org/profile/1700-abc.jpg',
    );
  });

  it('extracts the path from a legacy public bucket URL', () => {
    expect(
      avatarStoragePath(
        'https://project.example.invalid/storage/v1/object/public/public-avatars/org/profile/1700-abc.jpg',
      ),
    ).toBe('org/profile/1700-abc.jpg');
  });

  it.each([
    'https://images.example.invalid/photo.jpg',
    'https://project.example.invalid/storage/v1/object/sign/public-avatars/a.jpg?token=x',
    'file:///var/mobile/picked.jpg',
    '',
    null,
  ])('leaves %p unsigned', (value) => {
    expect(avatarStoragePath(value)).toBeNull();
  });
});

describe('resolveAvatarUri', () => {
  it('signs storage paths once and reuses the cached URL', async () => {
    const sign = jest.fn().mockResolvedValue('https://signed.example.invalid/a.jpg');
    await expect(resolveAvatarUri('org/profile/a.jpg', sign)).resolves.toBe(
      'https://signed.example.invalid/a.jpg',
    );
    await resolveAvatarUri('org/profile/a.jpg', sign);
    expect(sign).toHaveBeenCalledTimes(1);
    expect(sign).toHaveBeenCalledWith('org/profile/a.jpg');
    expect(peekAvatarUri('org/profile/a.jpg')).toBe(
      'https://signed.example.invalid/a.jpg',
    );
  });

  it('returns external URLs without signing', async () => {
    const sign = jest.fn();
    await expect(
      resolveAvatarUri('https://images.example.invalid/p.jpg', sign),
    ).resolves.toBe('https://images.example.invalid/p.jpg');
    expect(sign).not.toHaveBeenCalled();
  });

  it('resolves to null when signing fails, without caching the failure', async () => {
    const sign = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('https://signed.example.invalid/b.jpg');
    await expect(resolveAvatarUri('org/profile/b.jpg', sign)).resolves.toBeNull();
    await expect(resolveAvatarUri('org/profile/b.jpg', sign)).resolves.toBe(
      'https://signed.example.invalid/b.jpg',
    );
  });
});

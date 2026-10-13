import { nativeAnnotationApi } from './annotation-api';
import { apiGet, apiPost, capabilityGet, capabilityPost } from '@/lib/api/http-client';

jest.mock('@/lib/api/http-client', () => ({
  apiGet: jest.fn().mockResolvedValue({}),
  apiPost: jest.fn().mockResolvedValue({}),
  capabilityGet: jest.fn().mockResolvedValue({}),
  capabilityPost: jest.fn().mockResolvedValue({}),
}));

describe('native annotation authorization transport', () => {
  beforeEach(() => jest.clearAllMocks());
  it('uses the authenticated API client and encodes share identity', async () => {
    await nativeAnnotationApi('meeting/id', 'peer & 2').load();
    expect(apiGet).toHaveBeenCalledWith(
      '/screen-annotations/meeting%2Fid?shareKey=peer%20%26%202',
    );
    expect(capabilityGet).not.toHaveBeenCalled();
  });
  it('keeps guest capability out of the URL for reads and writes', async () => {
    const api = nativeAnnotationApi('meeting', 'peer', 'synthetic-capability');
    await api.load();
    const operation = { eventId: 'retry-id', kind: 'clear', scope: 'mine' } as const;
    await api.save('room/id', operation);
    expect(capabilityGet).toHaveBeenCalledWith(
      '/screen-annotations/guest/meeting?shareKey=peer',
      'synthetic-capability',
    );
    expect(capabilityPost).toHaveBeenCalledWith(
      '/screen-annotations/guest/room%2Fid/operations',
      'synthetic-capability',
      operation,
    );
    expect(apiPost).not.toHaveBeenCalled();
  });
  it('preserves operation IDs across caller retries', async () => {
    const api = nativeAnnotationApi('meeting', 'peer');
    const operation = { eventId: 'same-id', kind: 'clear', scope: 'mine' } as const;
    jest.mocked(apiPost).mockRejectedValueOnce(new Error('response lost'));
    await expect(api.save('room', operation)).rejects.toThrow('response lost');
    await api.save('room', operation);
    expect(jest.mocked(apiPost).mock.calls[0]).toEqual(
      jest.mocked(apiPost).mock.calls[1],
    );
  });
});

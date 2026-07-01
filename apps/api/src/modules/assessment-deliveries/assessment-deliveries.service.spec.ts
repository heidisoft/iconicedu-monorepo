import { ForbiddenException } from '@nestjs/common';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import { AssessmentDeliveriesService } from './assessment-deliveries.service';

jest.mock('@iconicedu/api/lib/supabase/service', () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const createSupabaseServiceClientMock = jest.mocked(createSupabaseServiceClient);

function createSelectChain(result: unknown) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(async () => result),
  };
  return chain;
}

function createUpsertChain(result: unknown) {
  return {
    upsert: jest.fn(async () => result),
  };
}

describe('AssessmentDeliveriesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects delivery participants outside the delivery org', async () => {
    const profilesQuery = createSelectChain({
      data: [{ id: 'profile-1' }],
      error: null,
    });
    createSupabaseServiceClientMock.mockReturnValue({
      from: jest.fn().mockReturnValueOnce(profilesQuery),
    } as never);

    await expect(
      new AssessmentDeliveriesService().addParticipants('delivery-1', 'org-1', [
        'profile-1',
        'external-profile',
      ]),
    ).rejects.toThrow(ForbiddenException);
  });

  it('adds participants after confirming every profile belongs to the delivery org', async () => {
    const profilesQuery = createSelectChain({
      data: [{ id: 'profile-1' }, { id: 'profile-2' }],
      error: null,
    });
    const participantWrite = createUpsertChain({ data: null, error: null });
    const from = jest
      .fn()
      .mockReturnValueOnce(profilesQuery)
      .mockReturnValueOnce(participantWrite);
    createSupabaseServiceClientMock.mockReturnValue({ from } as never);

    await new AssessmentDeliveriesService().addParticipants('delivery-1', 'org-1', [
      'profile-1',
      'profile-2',
    ]);

    expect(profilesQuery.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(profilesQuery.in).toHaveBeenCalledWith('id', ['profile-1', 'profile-2']);
    expect(participantWrite.upsert).toHaveBeenCalledWith(
      [
        { delivery_id: 'delivery-1', profile_id: 'profile-1' },
        { delivery_id: 'delivery-1', profile_id: 'profile-2' },
      ],
      { onConflict: 'delivery_id,profile_id' },
    );
  });
});

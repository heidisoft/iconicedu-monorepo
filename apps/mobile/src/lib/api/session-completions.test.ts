import {
  confirmSessionCompletion,
  disputeSessionCompletion,
  listSessionCompletions,
  rateSessionCompletion,
} from './session-completions';
import { apiGet, apiPost } from '@/lib/api/http-client';

jest.mock('@/lib/api/http-client', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}));

describe('session completion API client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists the current profile through the API', () => {
    listSessionCompletions({ orgId: 'org-1', profileId: 'profile-1', limit: 20 });

    expect(apiGet).toHaveBeenCalledWith('/session-completions', {
      orgId: 'org-1',
      profileId: 'profile-1',
      limit: 20,
    });
  });

  it('addresses confirm, dispute, and rate writes by completion id', () => {
    confirmSessionCompletion({
      orgId: 'org-1',
      sessionCompletionId: 'completion-1',
    });
    disputeSessionCompletion({
      orgId: 'org-1',
      sessionCompletionId: 'completion-1',
      disputeCategory: 'technical_issue',
      disputeReason: 'Audio failed',
      rescheduleRequested: true,
    });
    rateSessionCompletion({
      orgId: 'org-1',
      sessionCompletionId: 'completion-1',
      rating: 4,
      comment: 'Helpful',
    });

    expect(apiPost).toHaveBeenNthCalledWith(
      1,
      '/session-completions/completion-1/confirm',
      { orgId: 'org-1' },
    );
    expect(apiPost).toHaveBeenNthCalledWith(
      2,
      '/session-completions/completion-1/dispute',
      {
        orgId: 'org-1',
        disputeCategory: 'technical_issue',
        disputeReason: 'Audio failed',
        rescheduleRequested: true,
      },
    );
    expect(apiPost).toHaveBeenNthCalledWith(3, '/session-completions/completion-1/rate', {
      orgId: 'org-1',
      rating: 4,
      comment: 'Helpful',
    });
  });
});

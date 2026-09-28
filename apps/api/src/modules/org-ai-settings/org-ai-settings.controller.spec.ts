import { OrgAiSettingsController } from './org-ai-settings.controller';
import type { OrgAiSettingsService } from '@iconicedu/api/lib/ai/org-ai-settings.service';
import type { AuthenticatedRequest } from '@iconicedu/api/lib/http/authenticated-request';

function makeRequest(userId: string): AuthenticatedRequest {
  return { user: { id: userId }, headers: {} } as unknown as AuthenticatedRequest;
}

describe('OrgAiSettingsController', () => {
  function makeServiceMock() {
    return {
      getAdminView: jest.fn(),
      updateSettings: jest.fn(),
    } as unknown as jest.Mocked<OrgAiSettingsService>;
  }

  it('delegates GET to getAdminView with the caller and orgId', async () => {
    const service = makeServiceMock();
    service.getAdminView.mockResolvedValue({
      orgId: 'org-1',
      provider: 'anthropic',
      model: null,
      hasApiKey: false,
      apiKeyLastFour: null,
      messagingFeaturesEnabled: false,
      updatedAt: null,
    });
    const controller = new OrgAiSettingsController(service);

    const result = await controller.getSettings(makeRequest('auth-user-1'), 'org-1');

    expect(service.getAdminView).toHaveBeenCalledWith('auth-user-1', 'org-1');
    expect(result.orgId).toBe('org-1');
  });

  it('delegates PUT to updateSettings with the caller and body', async () => {
    const service = makeServiceMock();
    service.updateSettings.mockResolvedValue({
      orgId: 'org-1',
      provider: 'openai',
      model: 'gpt-4o-mini',
      hasApiKey: true,
      apiKeyLastFour: '1234',
      messagingFeaturesEnabled: true,
      updatedAt: '2026-01-01T00:00:00Z',
    });
    const controller = new OrgAiSettingsController(service);
    const body = {
      orgId: 'org-1',
      provider: 'openai' as const,
      apiKey: 'sk-openai-1234',
      messagingFeaturesEnabled: true,
    };

    const result = await controller.updateSettings(makeRequest('auth-user-1'), body);

    expect(service.updateSettings).toHaveBeenCalledWith('auth-user-1', 'org-1', body);
    expect(result.provider).toBe('openai');
  });
});

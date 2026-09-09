import { parseAdminToolsDispatchRequest } from './admin-tools.dto';
const orgId = '00000000-0000-4000-8000-000000000001';
describe('admin tool input', () => {
  it.each([
    'session-completions-dispatch',
    'push-notifications-dispatch',
    'schedule-reconciliation-dispatch',
  ])('accepts %s', (kind) => {
    expect(
      parseAdminToolsDispatchRequest({ orgId, kind, limit: 10, leaseSeconds: 60 }),
    ).toMatchObject({ orgId, kind, limit: 10, leaseSeconds: 60 });
  });
  it.each([
    null,
    [],
    {},
    { orgId: 'invalid', kind: 'events-dispatch' },
    { orgId, kind: 'unknown' },
    { orgId, kind: 'events-dispatch', limit: 0 },
    { orgId, kind: 'events-dispatch', limit: 201 },
    { orgId, kind: 'events-dispatch', limit: 1.5 },
    { orgId, kind: 'events-dispatch', leaseSeconds: 10 },
    { orgId, kind: 'events-dispatch', leaseOwner: '' },
  ])('rejects invalid requests %j', (input) => {
    expect(() => parseAdminToolsDispatchRequest(input)).toThrow();
  });
});

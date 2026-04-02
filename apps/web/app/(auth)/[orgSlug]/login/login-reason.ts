export function resolveOrgLoginReason(value?: string): 'session-expired' | null {
  return value === 'session-expired' ? 'session-expired' : null;
}

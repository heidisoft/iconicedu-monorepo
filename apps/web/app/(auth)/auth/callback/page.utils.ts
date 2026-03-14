type AuthCallbackSource = 'self-signup' | null;

export function shouldShowRoleOnboardingDialog(input: {
  authIntent: 'login' | 'get-started' | null;
  callbackSource: AuthCallbackSource;
  requiresRoleSelection: boolean;
}): boolean {
  return (
    input.requiresRoleSelection &&
    input.authIntent === 'get-started' &&
    input.callbackSource === 'self-signup'
  );
}

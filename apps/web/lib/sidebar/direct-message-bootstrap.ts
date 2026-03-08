type ShouldRetryDirectMessageBootstrapInput = {
  hasMessages: boolean;
  existsInSidebar: boolean;
  senderProfileId?: string | null;
  waitForMessages?: boolean;
};

export function shouldRetryDirectMessageBootstrap(
  input: ShouldRetryDirectMessageBootstrapInput,
) {
  if (input.hasMessages || input.existsInSidebar) {
    return false;
  }

  return Boolean(input.senderProfileId || input.waitForMessages);
}

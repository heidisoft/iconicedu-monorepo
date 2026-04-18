import { AsyncLocalStorage } from 'node:async_hooks';

export type ApiRequestContext = {
  requestId: string;
  method?: string;
  path?: string;
  route?: string;
  authUserId?: string;
  userRole?: string;
  startedAt?: string;
};

const storage = new AsyncLocalStorage<ApiRequestContext>();

export function runWithRequestContext<T>(
  context: ApiRequestContext,
  callback: () => T,
): T {
  return storage.run(context, callback);
}

export function getRequestContext(): ApiRequestContext | undefined {
  return storage.getStore();
}

export function updateRequestContext(
  patch: Partial<ApiRequestContext>,
): ApiRequestContext | undefined {
  const current = storage.getStore();
  if (!current) {
    return undefined;
  }

  Object.assign(current, patch);
  return current;
}

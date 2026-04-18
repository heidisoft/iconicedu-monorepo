import { randomUUID } from 'node:crypto';

import { runWithRequestContext } from '@iconicedu/api/observability/request-context';

export function requestContextMiddleware(
  req: {
    headers: Record<string, string | string[] | undefined>;
    method: string;
    originalUrl?: string;
    url: string;
  },
  res: {
    setHeader: (name: string, value: string) => void;
  },
  next: () => void,
) {
  const headerValue = req.headers['x-request-id'];
  const requestId =
    typeof headerValue === 'string' && headerValue.trim().length > 0
      ? headerValue.trim()
      : randomUUID();

  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);

  runWithRequestContext(
    {
      requestId,
      method: req.method,
      path: req.originalUrl ?? req.url,
      startedAt: new Date().toISOString(),
    },
    () => next(),
  );
}

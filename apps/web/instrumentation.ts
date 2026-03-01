import { capturePostHogServerException, getPostHogServerClient } from './lib/analytics/posthog-server';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    getPostHogServerClient();
  }
}

export async function onRequestError(
  error: unknown,
  request: Readonly<{
    path: string;
    method: string;
    headers: NodeJS.Dict<string | string[]>;
  }>,
  context: Readonly<{
    routerKind: 'Pages Router' | 'App Router';
    routePath: string;
    routeType: 'render' | 'route' | 'action' | 'middleware';
    renderSource?: 'react-server-components' | 'react-server-components-payload' | 'server-rendering';
    revalidateReason: 'on-demand' | 'stale' | undefined;
  }>,
) {
  capturePostHogServerException(error, {
    properties: {
      routePath: context.routePath,
      routeType: context.routeType,
      routerKind: context.routerKind,
      renderSource: context.renderSource,
      revalidateReason: context.revalidateReason,
      requestPath: request.path,
      requestMethod: request.method,
    },
  });
}

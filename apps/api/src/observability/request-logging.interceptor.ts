import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { AnalyticsService } from '@iconicedu/api/analytics/analytics.service';
import {
  getRequestContext,
  updateRequestContext,
} from '@iconicedu/api/observability/request-context';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);
  private readonly slowRequestThresholdMs = Number(
    process.env.API_SLOW_REQUEST_THRESHOLD_MS ?? '1000',
  );

  constructor(private readonly analytics: AnalyticsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<'http'>() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<{
      method: string;
      path?: string;
      route?: { path?: string };
      originalUrl?: string;
      url: string;
      user?: { id?: string; role?: string };
    }>();
    const res = http.getResponse<{ statusCode: number }>();
    const startedAt = Date.now();
    const routePath =
      typeof req.route?.path === 'string'
        ? req.route.path
        : typeof req.path === 'string'
          ? req.path
          : (req.originalUrl ?? req.url);

    updateRequestContext({
      method: req.method,
      path: req.originalUrl ?? req.url,
      route: routePath,
      authUserId: req.user?.id,
      userRole: req.user?.role,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startedAt;
          const statusCode = res.statusCode;
          const requestId = getRequestContext()?.requestId;

          this.logger.log(
            `${req.method} ${routePath} -> ${statusCode} (${durationMs}ms) reqId=${requestId ?? 'unknown'}`,
          );

          this.analytics.capture('api request completed', {
            userId: req.user?.id,
            requestId,
            method: req.method,
            route: routePath,
            path: req.originalUrl ?? req.url,
            statusCode,
            durationMs,
            isSlow: durationMs >= this.slowRequestThresholdMs,
          });

          if (durationMs >= this.slowRequestThresholdMs) {
            this.analytics.capture('api request slow', {
              userId: req.user?.id,
              requestId,
              method: req.method,
              route: routePath,
              path: req.originalUrl ?? req.url,
              statusCode,
              durationMs,
            });
          }
        },
      }),
    );
  }
}

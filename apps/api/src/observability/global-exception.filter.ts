import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { reportObservedError } from '@iconicedu/utils';

import { AnalyticsService } from '@iconicedu/api/analytics/analytics.service';
import { getRequestContext } from '@iconicedu/api/observability/request-context';

@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly analytics: AnalyticsService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();
    const request = http.getRequest<{
      method: string;
      route?: { path?: string };
      originalUrl?: string;
      url: string;
      user?: { id?: string; role?: string };
    }>();
    const context = getRequestContext();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const durationMs = context?.startedAt
      ? Date.now() - new Date(context.startedAt).getTime()
      : undefined;
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : typeof exceptionResponse === 'object' &&
            exceptionResponse &&
            'message' in exceptionResponse
          ? exceptionResponse['message']
          : exception instanceof Error
            ? exception.message
            : 'Internal server error';

    const properties = {
      requestId: context?.requestId,
      method: request.method,
      route:
        context?.route ??
        (typeof request.route?.path === 'string' ? request.route.path : undefined),
      path: request.originalUrl ?? request.url,
      statusCode,
      durationMs,
      authUserId: request.user?.id ?? context?.authUserId,
      userRole: request.user?.role ?? context?.userRole,
    };

    reportObservedError({
      error: exception,
      source: 'api.global_exception_filter',
      message: Array.isArray(message) ? message.join(', ') : String(message),
      context: properties,
    });

    this.analytics.capture('api request failed', {
      userId: request.user?.id ?? context?.authUserId,
      ...properties,
      errorMessage: Array.isArray(message) ? message.join(', ') : String(message),
    });

    const renderedMessage = Array.isArray(message) ? message.join(', ') : String(message);
    const line = `${request.method} ${request.originalUrl ?? request.url} -> ${statusCode} reqId=${context?.requestId ?? 'unknown'}: ${renderedMessage}`;
    if (statusCode >= 500) {
      this.logger.error(line, exception instanceof Error ? exception.stack : undefined);
    } else {
      this.logger.warn(line);
    }

    response.status(statusCode).json({
      statusCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url,
      requestId: context?.requestId,
    });
  }
}

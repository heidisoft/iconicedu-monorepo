import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostHog } from 'posthog-node';
import type { AnalyticsClient } from '@iconicedu/utils';

/**
 * Server-side analytics service backed by PostHog Node SDK.
 * Implements the vendor-agnostic AnalyticsClient interface so callers
 * don't import PostHog directly — swap the provider here without touching consumers.
 */
@Injectable()
export class AnalyticsService implements AnalyticsClient, OnModuleDestroy {
  private readonly client: PostHog | null;

  constructor(private readonly config: ConfigService) {
    const key = config.get<string>('POSTHOG_KEY');
    const host = config.get<string>('POSTHOG_HOST') ?? 'https://t.iconicedu.lk';
    const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';
    const isLocal = nodeEnv !== 'production';

    if (key && !isLocal) {
      this.client = new PostHog(key, {
        host,
        flushAt: 20,
        flushInterval: 10_000,
      });
    } else {
      this.client = null;
    }
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    this.client?.identify({ distinctId: userId, properties: traits });
  }

  capture(event: string, properties?: Record<string, unknown>): void {
    // Server-side events require a distinctId; fall back to 'server' for background jobs.
    const distinctId = (properties?.['userId'] as string | undefined) ?? 'server';
    this.client?.capture({ distinctId, event, properties });
  }

  /**
   * Capture an event on behalf of a known user.
   * Prefer this over capture() when you have the userId.
   */
  captureForUser(
    userId: string,
    event: string,
    properties?: Record<string, unknown>,
  ): void {
    this.client?.capture({ distinctId: userId, event, properties });
  }

  screen(_name: string, _properties?: Record<string, unknown>): void {
    // No-op on server; screen views are browser/mobile concepts.
  }

  reset(): void {
    // No-op on server; identity resets happen per-request in stateless APIs.
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.shutdown();
  }
}

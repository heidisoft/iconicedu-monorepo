import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { AnalyticsService } from '@iconicedu/api/analytics/analytics.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly slowQueryThresholdMs = Number(
    process.env.API_SLOW_QUERY_THRESHOLD_MS ?? '500',
  );

  constructor(private readonly analytics: AnalyticsService) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required for PrismaService');
    }

    super({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    (
      this as PrismaClient & {
        $on: (
          eventType: 'query',
          callback: (event: { duration: number; query: string; target: string }) => void,
        ) => void;
      }
    ).$on('query', (event) => {
      const durationMs = event.duration;
      const preview = event.query.replace(/\s+/g, ' ').slice(0, 180);

      if (durationMs >= this.slowQueryThresholdMs) {
        this.logger.warn(`Slow Prisma query (${durationMs}ms): ${preview}`);
        this.analytics.capture('api prisma slow query', {
          durationMs,
          target: event.target,
          queryPreview: preview,
        });
      }
    });

    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

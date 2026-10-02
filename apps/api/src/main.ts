import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '@iconicedu/api/app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { requestContextMiddleware } from '@iconicedu/api/observability/request-context.middleware';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: true });
  // Trust exactly one hop (the platform's own edge proxy, e.g. Railway)
  // so req.ip reflects the real client IP rather than the proxy's, and
  // so a client can't spoof X-Forwarded-For to defeat IP-keyed rate
  // limiting (see LiveSessionsPublicController's guest-join endpoint).
  app.set('trust proxy', 1);
  app.use(requestContextMiddleware);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('ICONIC Academy API')
    .setDescription('Backend for web and mobile clients')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
  logger.log(`API listening on port ${port}`);
}

void bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  logger.error(`API failed to start: ${message}`);
  process.exit(1);
});

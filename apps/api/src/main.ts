import { NestFactory } from '@nestjs/core';
import { AppModule } from '@iconicedu/api/app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { validateApiRuntimeEnv } from '@iconicedu/api/config/env';

async function bootstrap() {
  validateApiRuntimeEnv();

  const app = await NestFactory.create(AppModule, { cors: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('ICONIC EDU API')
    .setDescription('Backend for web and mobile clients')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT || 3000);
}

bootstrap();

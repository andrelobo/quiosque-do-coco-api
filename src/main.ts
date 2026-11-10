import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({
    origin: config.get('FRONTEND_URL') || 'http://localhost:5173',
    credentials: true,
  });

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new TransformInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Quiosque do Coco API')
    .setDescription('Sistema de atendimento e gestão de turnos')
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('auth_token')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get('PORT') || 4000;
  await app.listen(port);
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
  console.log(`📚 Swagger em http://localhost:${port}/api/docs`);
}

bootstrap();
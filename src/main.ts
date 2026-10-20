import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // При штатном завершении Nest закрывает worker-ы и соединения очереди.
  app.enableShutdownHooks();
  app.useGlobalPipes(
    // Проверяем DTO до записи в Redis, неизвестные поля удаляем (whitelist).
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();

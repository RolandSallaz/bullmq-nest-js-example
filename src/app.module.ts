// Загружаем .env до чтения process.env в настройках модулей.
import './env.js';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueModule } from './queue/queue.module.js';

@Module({
  imports: [
    // Общие настройки Redis для очередей и worker-ов этого приложения.
    // BullMQ управляет задачами, а Redis хранит их данные и состояние.
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? '127.0.0.1',
        port: Number(process.env.REDIS_PORT ?? 6379),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    QueueModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { QueueService } from './queue.service.js';
import { QueueController } from './queue.controller.js';
import { BullModule } from '@nestjs/bullmq';
import { emailQueueKEY } from './queue.constants.js';
import { EmailProcessor } from './email.processor.js';

@Module({
  imports: [
    // Регистрируем очередь по имени. Это же имя используют producer и worker.
    BullModule.registerQueue({
      name: emailQueueKEY,
    }),
  ],
  controllers: [QueueController],
  // Processor должен быть провайдером, чтобы Nest создал и запустил worker.
  providers: [QueueService, EmailProcessor],
})
export class QueueModule {}

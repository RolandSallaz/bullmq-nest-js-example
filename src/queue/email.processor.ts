import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { setTimeout } from 'node:timers/promises';
import { SendEmailDto } from './dto/SendEmailDto.js';
import { emailQueueKEY } from './queue.constants.js';

// Nest создаёт worker для очереди email и вызывает process() для каждой задачи.
// concurrency: 1 ограничивает этот worker; второй экземпляр приложения
// создаст ещё одного worker-а и сможет обрабатывать задачи параллельно.
@Processor(emailQueueKEY, { concurrency: 1 })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  async process(job: Job<SendEmailDto>) {
    // job.data — данные из Queue.add(). Счётчик растёт после завершения попытки.
    const attempt = job.attemptsMade + 1;
    this.logger.log(
      `Задача ${job.id}: попытка ${attempt}, адрес ${job.data.to}`,
    );
    // Повтор запускает process() заново, поэтому сбрасываем прогресс.
    await job.updateProgress(0);

    // Асинхронная задержка имитирует внешний почтовый сервис и не блокирует HTTP.
    // Worker выполняется в том же Node.js-процессе; тяжёлый синхронный код его блокировал бы.
    for (let progress = 20; progress <= 100; progress += 20) {
      await setTimeout(1000);
      if (progress === 100 && attempt <= (job.data.failAttempts ?? 0)) {
        // Исключение сообщает BullMQ о неудаче. Повтор организует сама библиотека
        // по attempts/backoff; вручную добавлять задачу заново не нужно.
        throw new Error('Учебная ошибка: почтовый сервис временно недоступен');
      }
      // Прогресс сохраняется в Redis. BullMQ не вычисляет проценты автоматически.
      await job.updateProgress(progress);
      this.logger.log(`Задача ${job.id}: ${progress}%`);
    }

    // Успешный return переводит задачу в completed; объект станет returnvalue.
    return {
      simulated: true,
      to: job.data.to,
      sentAt: new Date().toISOString(),
    };
  }

  @OnWorkerEvent('completed')
  // Локальное событие этого worker-а: здесь только выводим результат в лог.
  onCompleted(job: Job) {
    this.logger.log(`Задача ${job.id}: имитация отправки завершена`);
  }

  @OnWorkerEvent('failed')
  // Событие неудачной попытки не всегда означает итоговый статус failed:
  // если попытки остались, BullMQ запланирует повтор.
  onFailed(job: Job | undefined, error: Error) {
    this.logger.warn(`Задача ${job?.id}: ${error.message}`);
  }
}

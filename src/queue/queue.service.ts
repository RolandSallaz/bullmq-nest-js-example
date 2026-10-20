import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { SendEmailDto } from './dto/SendEmailDto.js';
import { emailQueueKEY } from './queue.constants.js';

@Injectable()
export class QueueService {
  constructor(
    // Получаем объект очереди email через внедрение зависимостей Nest.
    @InjectQueue(emailQueueKEY)
    private readonly emailQueue: Queue<SendEmailDto>,
  ) {}

  async sendEmail(dto: SendEmailDto) {
    // Producer сохраняет в Redis задачу типа send-email и её JSON-данные.
    // await ждёт записи в очередь, а не выполнения process() у worker-а.
    const job = await this.emailQueue.add('send-email', dto, {
      // Всего три попытки, включая первую (то есть максимум два повтора).
      attempts: 3,
      // После ошибок ждём минимум 1 и 2 секунды. Другие задачи могут идти раньше.
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });

    return {
      message: 'Письмо добавлено в очередь',
      jobId: job.id,
    };
  }

  async getStatus(jobId: string) {
    // Читаем сохранённую задачу из Redis; id не является индексом массива в Node.js.
    const job = await this.emailQueue.getJob(jobId);

    if (!job) {
      throw new NotFoundException('Задание не найдено');
    }

    // Состояние меняет BullMQ, прогресс задаёт наш process().
    // Результат — возвращённое process() значение, сохранённое после успеха.
    // Эти поля читаются отдельно: worker может обновить задачу во время запроса.
    return {
      id: job.id,
      name: job.name,
      status: await job.getState(),
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason || null,
      result: job.returnvalue ?? null,
    };
  }
}

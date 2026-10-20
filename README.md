# BullMQ в NestJS: очередь отправки писем

В примере HTTP-запрос ставит задачу в очередь, а worker имитирует отправку
письма за 5 секунд. BullMQ управляет задачами, Redis хранит их данные и состояние.

## Запуск

```powershell
npm install
# Если .env ещё нет:
Copy-Item .env.example .env
```

Укажите в .env подключение к Redis:

```dotenv
REDIS_HOST=192.168.1.92
REDIS_PORT=6379
REDIS_PASSWORD=ваш_пароль
PORT=3000
```

```powershell
npm run start:dev
```

## 1. Подключить BullMQ к Redis

В src/app.module.ts задаём общее подключение:

```ts
BullModule.forRoot({
  connection: {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  },
});
```

В этом проекте src/env.ts загружает .env перед чтением настроек.

## 2. Зарегистрировать очередь

В src/queue/queue.module.ts:

```ts
BullModule.registerQueue({ name: emailQueueKEY });
```

emailQueueKEY равен 'email'. Это имя связывает очередь, сервис и обработчик.
Обработчик EmailProcessor обязательно добавляем в providers модуля.

## 3. Добавить задачу — producer

В QueueService получаем очередь через внедрение зависимостей:

```ts
constructor(
  @InjectQueue(emailQueueKEY)
  private readonly emailQueue: Queue<SendEmailDto>,
) {}
```

Затем добавляем задачу:

```ts
const job = await this.emailQueue.add('send-email', dto, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
});
```

- email — имя очереди.
- send-email — имя задачи внутри очереди.
- dto — данные письма, которые получит обработчик.
- job.id — идентификатор для запроса состояния.
- attempts: 3 — первая попытка и максимум два повтора.
- backoff — паузы перед повторами: 1 и 2 секунды.

await queue.add() ждёт записи задачи в Redis. Выполнения задачи он не ждёт.
Поэтому POST /queue/email возвращает HTTP 202 с jobId сразу после добавления.

## 4. Выполнить задачу — worker

В src/queue/email.processor.ts:

```ts
@Processor(emailQueueKEY, { concurrency: 1 })
export class EmailProcessor extends WorkerHost {
  async process(job: Job<SendEmailDto>) {
    // job.data содержит dto, переданный в queue.add().
    await job.updateProgress(0);

    // Здесь выполняется работа: в проекте — задержки вместо отправки.

    await job.updateProgress(100);
    return { simulated: true, to: job.data.to };
  }
}
```

BullMQ сам вызывает process(), когда worker получает задачу.
concurrency: 1 означает одну задачу одновременно у этого worker-а.

- updateProgress() записывает прогресс в Redis. Проценты задаём сами.
- return завершает задачу успешно: состояние completed, значение доступно в returnvalue.
- throw new Error() завершает попытку с ошибкой. BullMQ повторит её согласно attempts и backoff.

Повтор заново вызывает process() с той же задачей. Добавлять её через add() повторно не нужно.
В проекте failAttempts задаёт число искусственных ошибок: 1 — успех со второй
попытки, 3 — окончательный failed.

## 5. Прочитать состояние

В QueueService:

```ts
const job = await this.emailQueue.getJob(jobId);
if (!job) throw new NotFoundException('Задание не найдено');

return {
  status: await job.getState(),
  progress: job.progress,
  attemptsMade: job.attemptsMade,
  result: job.returnvalue,
};
```

| Состояние | Что происходит                   |
| --------- | -------------------------------- |
| waiting   | Задача ждёт worker-а             |
| active    | Выполняется process()            |
| delayed   | Задача ждёт повтора после ошибки |
| completed | process() завершился успешно     |
| failed    | Попытки исчерпаны                |

attemptsMade — число завершившихся попыток, включая успешную.
Весь ответ API доступен по GET /queue/jobs/:jobId.

## Что попробовать изменить

1. Поставьте concurrency: 2 и отправьте несколько задач: две будут выполняться одновременно.
2. Измените attempts на 1: ошибка сразу приведёт к failed.
3. Измените backoff.delay на 5000: повтор начнётся не раньше чем через 5 секунд.

Сейчас завершённые задачи сохраняются для просмотра. Для автоматической очистки
можно задать removeOnComplete и removeOnFail в параметрах add().

Worker работает в том же процессе, что и HTTP-сервер. Redis хранит очередь,
но код process() выполняет Node.js. Для реальных внешних действий учитывайте,
что задача может выполняться повторно: повтор не должен создавать дубликаты.

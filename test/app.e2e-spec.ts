import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { setTimeout } from 'node:timers/promises';
import { AppModule } from './../src/app.module.js';

describe.skipIf(process.env.RUN_REDIS_E2E !== '1')(
  'Email queue with Redis',
  () => {
    let app: INestApplication;

    beforeAll(async () => {
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = module.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      await app.init();
    });

    afterAll(async () => {
      await app?.close();
    });

    it('accepts a job and completes it in the background', async () => {
      const response = await request(app.getHttpServer())
        .post('/queue/email')
        .send({ to: 'student@example.com', subject: 'Lesson', text: 'Hello' })
        .expect(202);
      expect(response.body.jobId).toBeDefined();
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        const status = await request(app.getHttpServer())
          .get(`/queue/jobs/${response.body.jobId}`)
          .expect(200);
        if (status.body.status === 'completed') {
          expect(status.body.progress).toBe(100);
          expect(status.body.result.simulated).toBe(true);
          return;
        }
        await setTimeout(250);
      }
      throw new Error('Job did not complete within 15 seconds');
    }, 20000);
  },
);

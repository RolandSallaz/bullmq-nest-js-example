import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { SendEmailDto } from './dto/SendEmailDto.js';
import { QueueService } from './queue.service.js';

@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post('email')
  // 202 означает: задача принята; фоновая отправка ещё не завершена.
  @HttpCode(202)
  sendEmail(@Body() dto: SendEmailDto) {
    return this.queueService.sendEmail(dto);
  }

  @Get('jobs/:jobId')
  // Клиент опрашивает этот маршрут по id из ответа POST.
  getStatus(@Param('jobId') jobId: string) {
    return this.queueService.getStatus(jobId);
  }
}

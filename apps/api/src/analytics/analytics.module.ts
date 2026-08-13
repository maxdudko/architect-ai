import { Module } from '@nestjs/common';
import { AnswerFeedbackService } from './answer-feedback.service';
import { AnalyticsService } from './analytics.service';

@Module({
  providers: [AnalyticsService, AnswerFeedbackService],
  exports: [AnalyticsService, AnswerFeedbackService],
})
export class AnalyticsModule {}

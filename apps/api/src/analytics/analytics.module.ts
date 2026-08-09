import { Module, forwardRef } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { AnswerFeedbackService } from './answer-feedback.service';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [forwardRef(() => RepositoriesModule)],
  providers: [AnalyticsService, AnswerFeedbackService],
  exports: [AnalyticsService, AnswerFeedbackService],
})
export class AnalyticsModule {}

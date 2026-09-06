import { Module } from '@nestjs/common';
import { IndexingResourceLimitService } from './indexing-resource-limit.service';
import { UsageService } from './usage.service';

@Module({
  providers: [UsageService, IndexingResourceLimitService],
  exports: [UsageService, IndexingResourceLimitService],
})
export class UsageModule {}

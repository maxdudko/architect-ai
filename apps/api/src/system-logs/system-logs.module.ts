import { Global, Module } from '@nestjs/common';
import { SystemLogsRepository } from './system-logs.repository';
import { SystemLogsService } from './system-logs.service';

@Global()
@Module({
  providers: [SystemLogsRepository, SystemLogsService],
  exports: [SystemLogsService],
})
export class SystemLogsModule {}

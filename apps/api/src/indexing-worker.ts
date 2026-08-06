import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { initErrorTracker } from './common/observability/error-tracker';

async function bootstrapWorker(): Promise<void> {
  process.env.INDEXING_WORKER_ENABLED = 'true';
  initErrorTracker();
  const logger = new Logger('IndexingWorker');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  logger.log('Repository indexing worker started');

  const shutdown = async () => {
    logger.log('Shutting down repository indexing worker');
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
}

void bootstrapWorker();

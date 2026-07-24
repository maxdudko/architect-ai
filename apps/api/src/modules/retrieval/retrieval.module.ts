import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { InMemoryRetrievalCache } from './cache/in-memory-retrieval.cache';
import { RedisRetrievalCache } from './cache/redis-retrieval.cache';
import { ContextAssemblerService } from './context/context-assembler.service';
import { HashEmbeddingProvider } from './embeddings/providers/hash-embedding.provider';
import { OpenAiEmbeddingProvider } from './embeddings/providers/openai-embedding.provider';
import { PrismaChunkDataSource } from './indexing/prisma-chunk-data-source';
import { RetrievalIndexingService } from './indexing/retrieval-indexing.service';
import type { EmbeddingProvider } from './interfaces/embedding-provider.interface';
import {
  CHUNK_DATA_SOURCE,
  EMBEDDING_PROVIDER,
  RETRIEVAL_CACHE,
  VECTOR_STORE,
} from './interfaces/tokens';
import { RetrievalMetricsService } from './metrics/retrieval-metrics.service';
import { SearchRankingService } from './ranking/search-ranking.service';
import { RetrievalService } from './retrieval.service';
import { SemanticSearchService } from './search/semantic-search.service';
import { QdrantVectorStore } from './vector-store/qdrant.vector-store';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [
    HashEmbeddingProvider,
    OpenAiEmbeddingProvider,
    {
      provide: EMBEDDING_PROVIDER,
      inject: [ConfigService, HashEmbeddingProvider, OpenAiEmbeddingProvider],
      useFactory: (
        configService: ConfigService,
        hashProvider: HashEmbeddingProvider,
        openAiProvider: OpenAiEmbeddingProvider,
      ): EmbeddingProvider => {
        const provider =
          configService.get<string>('EMBEDDING_PROVIDER') ?? 'mock';
        if (provider === 'openai') {
          return openAiProvider;
        }
        return hashProvider;
      },
    },
    QdrantVectorStore,
    {
      provide: VECTOR_STORE,
      useExisting: QdrantVectorStore,
    },
    {
      provide: RETRIEVAL_CACHE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const driver =
          configService.get<string>('RETRIEVAL_CACHE_DRIVER') ?? 'redis';
        return driver === 'memory'
          ? new InMemoryRetrievalCache()
          : new RedisRetrievalCache(configService);
      },
    },
    PrismaChunkDataSource,
    {
      provide: CHUNK_DATA_SOURCE,
      useExisting: PrismaChunkDataSource,
    },
    RetrievalMetricsService,
    SemanticSearchService,
    SearchRankingService,
    ContextAssemblerService,
    RetrievalIndexingService,
    RetrievalService,
  ],
  exports: [
    EMBEDDING_PROVIDER,
    VECTOR_STORE,
    RETRIEVAL_CACHE,
    CHUNK_DATA_SOURCE,
    RetrievalMetricsService,
    SemanticSearchService,
    SearchRankingService,
    ContextAssemblerService,
    RetrievalIndexingService,
    RetrievalService,
  ],
})
export class RetrievalModule {}

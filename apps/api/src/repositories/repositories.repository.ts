import { Injectable } from '@nestjs/common';
import {
  Prisma,
  Repository,
  RepositoryProvider,
  RepositoryStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RepositoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    workspaceId: string,
    data: {
      provider: RepositoryProvider;
      externalId: string;
      owner: string;
      name: string;
      fullName: string;
      defaultBranch: string;
    },
  ): Promise<Repository> {
    return this.prisma.repository.create({
      data: {
        workspaceId,
        provider: data.provider,
        externalId: data.externalId,
        owner: data.owner,
        name: data.name,
        fullName: data.fullName,
        defaultBranch: data.defaultBranch,
        status: RepositoryStatus.PENDING,
      },
    });
  }

  findById(workspaceId: string, repositoryId: string): Promise<Repository | null> {
    return this.prisma.repository.findFirst({
      where: {
        id: repositoryId,
        workspaceId,
        deletedAt: null,
      },
    });
  }

  findByProviderAndExternalId(
    provider: RepositoryProvider,
    externalId: string,
  ): Promise<Repository | null> {
    return this.prisma.repository.findFirst({
      where: {
        provider,
        externalId,
        deletedAt: null,
      },
    });
  }

  listByWorkspace(workspaceId: string): Promise<Repository[]> {
    return this.prisma.repository.findMany({
      where: {
        workspaceId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    workspaceId: string,
    repositoryId: string,
    data: Prisma.RepositoryUpdateInput,
  ): Promise<Repository | null> {
    const result = await this.prisma.repository.updateMany({
      where: {
        id: repositoryId,
        workspaceId,
        deletedAt: null,
      },
      data,
    });

    if (result.count === 0) {
      return null;
    }

    return this.findById(workspaceId, repositoryId);
  }

  async softDelete(workspaceId: string, repositoryId: string): Promise<number> {
    const result = await this.prisma.repository.updateMany({
      where: {
        id: repositoryId,
        workspaceId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return result.count;
  }
}

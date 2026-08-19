import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider, WorkspaceRole } from '@prisma/client';
import { TokenCipherService } from '../common/crypto/token-cipher.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { TestWorkspaceAiKeyResponseDto } from './dto/test-workspace-ai-credential.dto';
import { WorkspaceAiSettingsResponseDto } from './dto/workspace-ai-settings-response.dto';

const KEY_TEST_TIMEOUT_MS = 10_000;

const PROVIDER_LABEL: Record<AiProvider, string> = {
  [AiProvider.OPENAI]: 'OpenAI',
  [AiProvider.ANTHROPIC]: 'Anthropic',
  [AiProvider.GROK]: 'Grok',
  [AiProvider.GEMINI]: 'Gemini',
};

@Injectable()
export class WorkspaceAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenCipherService: TokenCipherService,
    private readonly workspacesService: WorkspacesService,
    private readonly configService: ConfigService,
  ) {}

  async getSettings(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceAiSettingsResponseDto> {
    await this.assertCanManageAi(workspaceId, userId);
    return this.loadResponse(workspaceId);
  }

  async upsertCredential(
    workspaceId: string,
    userId: string,
    provider: AiProvider,
    apiKey: string,
  ): Promise<WorkspaceAiSettingsResponseDto> {
    await this.assertCanManageAi(workspaceId, userId);
    const trimmed = apiKey.trim();
    if (!trimmed) {
      throw new BadRequestException('API key cannot be empty');
    }

    const encrypted = this.tokenCipherService.encrypt(trimmed);
    const last4 = trimmed.slice(-4);

    await this.prisma.$transaction([
      this.prisma.workspaceAiCredential.upsert({
        where: { workspaceId_provider: { workspaceId, provider } },
        create: {
          workspaceId,
          provider,
          apiKeyEncrypted: encrypted,
          keyLast4: last4,
        },
        update: { apiKeyEncrypted: encrypted, keyLast4: last4 },
      }),
      this.prisma.workspaceAiSettings.upsert({
        where: { workspaceId },
        create: { workspaceId, activeProvider: provider },
        update: { activeProvider: provider },
      }),
    ]);

    return this.loadResponse(workspaceId);
  }

  async setActiveProvider(
    workspaceId: string,
    userId: string,
    provider: AiProvider | null | undefined,
  ): Promise<WorkspaceAiSettingsResponseDto> {
    await this.assertCanManageAi(workspaceId, userId);
    const nextProvider = provider ?? null;

    if (nextProvider) {
      const credential = await this.prisma.workspaceAiCredential.findUnique({
        where: {
          workspaceId_provider: { workspaceId, provider: nextProvider },
        },
      });
      if (!credential) {
        throw new BadRequestException(
          `No saved ${PROVIDER_LABEL[nextProvider]} API key for this workspace. Save one first.`,
        );
      }
    }

    await this.prisma.workspaceAiSettings.upsert({
      where: { workspaceId },
      create: { workspaceId, activeProvider: nextProvider },
      update: { activeProvider: nextProvider },
    });

    return this.loadResponse(workspaceId);
  }

  async deleteCredential(
    workspaceId: string,
    userId: string,
    provider: AiProvider,
  ): Promise<WorkspaceAiSettingsResponseDto> {
    await this.assertCanManageAi(workspaceId, userId);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.workspaceAiCredential.deleteMany({
        where: { workspaceId, provider },
      });
      const settings = await transaction.workspaceAiSettings.findUnique({
        where: { workspaceId },
      });
      if (settings?.activeProvider === provider) {
        await transaction.workspaceAiSettings.update({
          where: { workspaceId },
          data: { activeProvider: null },
        });
      }
    });

    return this.loadResponse(workspaceId);
  }

  async testCredential(
    workspaceId: string,
    userId: string,
    provider: AiProvider,
    apiKey?: string,
  ): Promise<TestWorkspaceAiKeyResponseDto> {
    await this.assertCanManageAi(workspaceId, userId);
    const label = PROVIDER_LABEL[provider];

    const pasted = apiKey?.trim();
    if (pasted) {
      await this.assertProviderKeyWorks(provider, pasted);
      return { ok: true, message: `${label} accepted this API key.` };
    }

    const credential = await this.prisma.workspaceAiCredential.findUnique({
      where: { workspaceId_provider: { workspaceId, provider } },
    });
    if (!credential) {
      throw new BadRequestException(
        `Paste an API key for ${label} to test, or save one first.`,
      );
    }

    await this.assertProviderKeyWorks(
      provider,
      this.tokenCipherService.decrypt(credential.apiKeyEncrypted),
    );
    return { ok: true, message: `${label} accepted the saved API key.` };
  }

  /** Used only by `WorkspaceLlmResolver`; never exposed over HTTP. */
  async getActiveCredential(
    workspaceId: string,
  ): Promise<{ provider: AiProvider; apiKey: string } | null> {
    const settings = await this.prisma.workspaceAiSettings.findUnique({
      where: { workspaceId },
      select: { activeProvider: true },
    });
    if (!settings?.activeProvider) {
      return null;
    }

    const credential = await this.prisma.workspaceAiCredential.findUnique({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: settings.activeProvider,
        },
      },
    });
    if (!credential) {
      return null;
    }

    return {
      provider: settings.activeProvider,
      apiKey: this.tokenCipherService.decrypt(credential.apiKeyEncrypted),
    };
  }

  private async loadResponse(
    workspaceId: string,
  ): Promise<WorkspaceAiSettingsResponseDto> {
    const [settings, credentials] = await Promise.all([
      this.prisma.workspaceAiSettings.findUnique({ where: { workspaceId } }),
      this.prisma.workspaceAiCredential.findMany({
        where: { workspaceId },
        orderBy: { provider: 'asc' },
      }),
    ]);

    return {
      mode: settings?.activeProvider ? 'BYOK' : 'HOSTED',
      activeProvider: settings?.activeProvider ?? null,
      credentials: credentials.map((credential) => ({
        provider: credential.provider,
        keyLast4: credential.keyLast4,
        updatedAt: credential.updatedAt.toISOString(),
      })),
    };
  }

  private async assertCanManageAi(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const { role } = await this.workspacesService.getWorkspaceForUser(
      workspaceId,
      userId,
    );
    if (!(role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN)) {
      throw new ForbiddenException(
        'Only workspace owners and admins can manage AI provider settings',
      );
    }
  }

  private async assertProviderKeyWorks(
    provider: AiProvider,
    apiKey: string,
  ): Promise<void> {
    const label = PROVIDER_LABEL[provider];
    const { url, headers } = this.buildTestRequest(provider, apiKey);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(KEY_TEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadGatewayException(
        `Unable to reach ${label} to test this API key.`,
      );
    }

    if (response.ok) {
      return;
    }
    if (response.status === 401 || response.status === 403) {
      throw new BadRequestException(`${label} rejected this API key.`);
    }
    throw new BadGatewayException(
      `${label} key test failed (${response.status}).`,
    );
  }

  private buildTestRequest(
    provider: AiProvider,
    apiKey: string,
  ): { url: string; headers: Record<string, string> } {
    switch (provider) {
      case AiProvider.OPENAI: {
        const baseUrl = (
          this.configService.get<string>('OPENAI_API_BASE_URL') ??
          'https://api.openai.com/v1'
        ).replace(/\/$/, '');
        return {
          url: `${baseUrl}/models`,
          headers: { authorization: `Bearer ${apiKey}` },
        };
      }
      case AiProvider.ANTHROPIC:
        return {
          url: 'https://api.anthropic.com/v1/models',
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        };
      case AiProvider.GROK:
        return {
          url: 'https://api.x.ai/v1/models',
          headers: { authorization: `Bearer ${apiKey}` },
        };
      case AiProvider.GEMINI:
        return {
          url: 'https://generativelanguage.googleapis.com/v1beta/models',
          headers: { 'x-goog-api-key': apiKey },
        };
    }
  }
}

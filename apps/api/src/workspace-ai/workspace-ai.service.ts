import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkspaceRole } from '@prisma/client';
import { TokenCipherService } from '../common/crypto/token-cipher.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { TestWorkspaceAiKeyResponseDto } from './dto/test-workspace-ai-key.dto';
import { WorkspaceAiSettingsResponseDto } from './dto/workspace-ai-settings-response.dto';

const OPENAI_KEY_TEST_TIMEOUT_MS = 10_000;

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
    const settings = await this.prisma.workspaceAiSettings.findUnique({
      where: { workspaceId },
    });
    return this.toResponse(settings);
  }

  async upsertSettings(
    workspaceId: string,
    userId: string,
    openaiApiKey: string,
  ): Promise<WorkspaceAiSettingsResponseDto> {
    await this.assertCanManageAi(workspaceId, userId);
    const trimmed = openaiApiKey.trim();
    if (!trimmed) {
      throw new BadRequestException('OpenAI API key cannot be empty');
    }

    const encrypted = this.tokenCipherService.encrypt(trimmed);
    const last4 = trimmed.slice(-4);
    const settings = await this.prisma.workspaceAiSettings.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        openaiApiKeyEncrypted: encrypted,
        openaiKeyLast4: last4,
      },
      update: {
        openaiApiKeyEncrypted: encrypted,
        openaiKeyLast4: last4,
      },
    });
    return this.toResponse(settings);
  }

  async deleteSettings(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceAiSettingsResponseDto> {
    await this.assertCanManageAi(workspaceId, userId);
    await this.prisma.workspaceAiSettings.deleteMany({
      where: { workspaceId },
    });
    return this.toResponse(null);
  }

  async getEncryptedKey(workspaceId: string): Promise<string | null> {
    const settings = await this.prisma.workspaceAiSettings.findUnique({
      where: { workspaceId },
      select: { openaiApiKeyEncrypted: true },
    });
    return settings?.openaiApiKeyEncrypted ?? null;
  }

  async testApiKey(
    workspaceId: string,
    userId: string,
    openaiApiKey?: string,
  ): Promise<TestWorkspaceAiKeyResponseDto> {
    await this.assertCanManageAi(workspaceId, userId);

    const pasted = openaiApiKey?.trim();
    if (pasted) {
      await this.assertOpenAiKeyWorks(pasted);
      return { ok: true, message: 'OpenAI accepted this API key.' };
    }

    const encrypted = await this.getEncryptedKey(workspaceId);
    if (!encrypted) {
      throw new BadRequestException(
        'Paste an OpenAI API key to test, or save one first.',
      );
    }

    await this.assertOpenAiKeyWorks(this.tokenCipherService.decrypt(encrypted));
    return { ok: true, message: 'OpenAI accepted the saved API key.' };
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

  private async assertOpenAiKeyWorks(apiKey: string): Promise<void> {
    const baseUrl = (
      this.configService.get<string>('OPENAI_API_BASE_URL') ??
      'https://api.openai.com/v1'
    ).replace(/\/$/, '');

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers: { authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(OPENAI_KEY_TEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadGatewayException(
        'Unable to reach OpenAI to test this API key.',
      );
    }

    if (response.ok) {
      return;
    }
    if (response.status === 401 || response.status === 403) {
      throw new BadRequestException('OpenAI rejected this API key.');
    }
    throw new BadGatewayException(
      `OpenAI key test failed (${response.status}).`,
    );
  }

  private toResponse(
    settings: {
      openaiApiKeyEncrypted: string | null;
      openaiKeyLast4: string | null;
      updatedAt: Date;
    } | null,
  ): WorkspaceAiSettingsResponseDto {
    const hasKey = Boolean(settings?.openaiApiKeyEncrypted);
    return {
      mode: hasKey ? 'BYOK' : 'HOSTED',
      openaiKeyLast4: hasKey ? (settings?.openaiKeyLast4 ?? null) : null,
      updatedAt: hasKey ? (settings?.updatedAt.toISOString() ?? null) : null,
    };
  }
}

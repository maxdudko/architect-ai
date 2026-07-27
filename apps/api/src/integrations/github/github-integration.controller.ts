import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { RequestUser } from '../../common/interfaces/request-user.interface';
import { GithubIntegrationService } from './github-integration.service';
import { GithubCallbackQueryDto } from './dto/github-callback-query.dto';
import { GithubConnectUrlQueryDto } from './dto/github-connect-url-query.dto';
import { GithubConnectionResponseDto } from './dto/github-connection-response.dto';
import { GithubRepositoriesResponseDto } from './dto/github-repositories-response.dto';
import { GithubBranchesResponseDto } from './dto/github-branches-response.dto';
import { ListGithubRepositoriesQueryDto } from './dto/list-github-repositories-query.dto';
import { ListGithubBranchesQueryDto } from './dto/list-github-branches-query.dto';

@ApiTags('GitHub Integration')
@Controller('integrations/github')
export class GithubIntegrationController {
  constructor(
    private readonly githubIntegrationService: GithubIntegrationService,
    private readonly configService: ConfigService,
  ) {}

  @Get('connect-url')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a GitHub OAuth connect URL' })
  async getConnectUrl(
    @CurrentUser() user: RequestUser,
    @Query() query: GithubConnectUrlQueryDto,
  ): Promise<{ url: string }> {
    const url = await this.githubIntegrationService.getConnectUrl(
      user.sub,
      query.workspaceId,
    );
    return { url };
  }

  @Get('callback')
  @ApiOperation({ summary: 'GitHub OAuth callback endpoint' })
  async callback(
    @Query() query: GithubCallbackQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const webUrl =
      this.configService.get<string>('WEB_URL') ?? 'http://localhost:3000';

    try {
      const result = await this.githubIntegrationService.processCallback({
        code: query.code,
        state: query.state,
        error: query.error,
        errorDescription: query.error_description,
      });

      const redirectUrl = new URL('/repositories', webUrl);
      redirectUrl.searchParams.set('github_oauth', 'success');
      if (result.workspaceId) {
        redirectUrl.searchParams.set('workspaceId', result.workspaceId);
      }
      response.redirect(redirectUrl.toString());
    } catch (error) {
      const redirectUrl = new URL('/repositories', webUrl);
      redirectUrl.searchParams.set('github_oauth', 'error');
      redirectUrl.searchParams.set(
        'reason',
        error instanceof Error ? error.message : 'OAuth callback failed',
      );
      response.redirect(redirectUrl.toString());
    }
  }

  @Get('connection')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get GitHub connection state for current user' })
  getConnection(
    @CurrentUser() user: RequestUser,
  ): Promise<GithubConnectionResponseDto> {
    return this.githubIntegrationService.getConnection(user.sub);
  }

  @Delete('connection')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Disconnect GitHub account for current user' })
  disconnect(@CurrentUser() user: RequestUser): Promise<{ success: boolean }> {
    return this.githubIntegrationService.disconnect(user.sub);
  }

  @Get('repositories')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List GitHub repositories available to connect' })
  listRepositories(
    @CurrentUser() user: RequestUser,
    @Query() query: ListGithubRepositoriesQueryDto,
  ): Promise<GithubRepositoriesResponseDto> {
    return this.githubIntegrationService.listRepositories(
      user.sub,
      query.workspaceId,
      query.cursor,
    );
  }

  @Get('repositories/:externalId/branches')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List branches for a GitHub repository' })
  listBranches(
    @CurrentUser() user: RequestUser,
    @Param('externalId') externalId: string,
    @Query() query: ListGithubBranchesQueryDto,
  ): Promise<GithubBranchesResponseDto> {
    return this.githubIntegrationService.listBranches(
      user.sub,
      query.workspaceId,
      externalId,
      query.cursor,
    );
  }
}

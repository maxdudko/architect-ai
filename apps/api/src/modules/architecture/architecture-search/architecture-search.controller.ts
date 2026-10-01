import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../../../common/guards/workspace-param.guard';
import type { RequestUser } from '../../../common/interfaces/request-user.interface';
import { ArchitectureSearchService } from './architecture-search.service';
import {
  AskArchitectureSearchDto,
  type ArchitectureSearchAnswerDto,
  type ArchitectureSearchThreadDto,
} from './dto/architecture-search.dto';

const READ_ROLES = [
  WorkspaceRole.OWNER,
  WorkspaceRole.ADMIN,
  WorkspaceRole.MEMBER,
  WorkspaceRole.VIEWER,
] as const;

const ASK_ROLES = [
  WorkspaceRole.OWNER,
  WorkspaceRole.ADMIN,
  WorkspaceRole.MEMBER,
] as const;

/**
 * Architecture Search reads and questions for one repository.
 * Asking follows the chat generation roles. Reading includes the read-only role.
 */
@ApiTags('Architecture')
@ApiBearerAuth()
@Controller('workspaces/:id/repositories/:repositoryId/architecture/search')
@UseGuards(JwtAuthGuard, WorkspaceParamGuard, RolesGuard)
export class ArchitectureSearchController {
  constructor(
    private readonly architectureSearchService: ArchitectureSearchService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Read architecture search answers for a repository',
  })
  @Roles(...READ_ROLES)
  getThread(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<ArchitectureSearchThreadDto> {
    return this.architectureSearchService.getThread(
      workspaceId,
      repositoryId,
      user.sub,
    );
  }

  @Post('messages')
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @ApiOperation({
    summary: 'Ask an architecture question and receive a full answer',
  })
  @Roles(...ASK_ROLES)
  ask(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: AskArchitectureSearchDto,
  ): Promise<ArchitectureSearchAnswerDto> {
    return this.architectureSearchService.ask(
      workspaceId,
      repositoryId,
      user.sub,
      dto.content,
    );
  }

  @Post('messages/stream')
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @ApiOperation({
    summary: 'Ask an architecture question and stream the answer',
  })
  @Roles(...ASK_ROLES)
  async stream(
    @Param('id') workspaceId: string,
    @Param('repositoryId') repositoryId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: AskArchitectureSearchDto,
    @Res() res: Response,
  ): Promise<void> {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      for await (const event of this.architectureSearchService.stream(
        workspaceId,
        repositoryId,
        user.sub,
        dto.content,
      )) {
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch {
      const message =
        'Architecture search could not generate an answer. Try again.';
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
      res.write(`event: done\n`);
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } finally {
      res.end();
    }
  }
}

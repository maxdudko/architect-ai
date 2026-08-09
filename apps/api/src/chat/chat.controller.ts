import { Body, Controller, Param, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
import type { Response } from 'express';
import { AnswerFeedbackService } from '../analytics/answer-feedback.service';
import { AnswerFeedbackResponseDto } from '../analytics/dto/answer-feedback-response.dto';
import { UpsertAnswerFeedbackDto } from '../analytics/dto/upsert-answer-feedback.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../common/guards/workspace-param.guard';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { ChatService } from './chat.service';
import { ChatAnswerResponseDto } from './dto/chat-answer-response.dto';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('workspaces/:id/conversations/:conversationId')
@UseGuards(JwtAuthGuard, WorkspaceParamGuard, RolesGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly answerFeedbackService: AnswerFeedbackService,
  ) {}

  @Post('messages')
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @ApiOperation({ summary: 'Ask a question and receive a full answer' })
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  ask(
    @Param('id') workspaceId: string,
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateChatMessageDto,
  ): Promise<ChatAnswerResponseDto> {
    return this.chatService.ask(
      workspaceId,
      conversationId,
      user.sub,
      dto.content,
    );
  }

  @Post('messages/stream')
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @ApiOperation({ summary: 'Ask a question and stream the answer as SSE' })
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  async stream(
    @Param('id') workspaceId: string,
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateChatMessageDto,
    @Res() res: Response,
  ): Promise<void> {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      for await (const event of this.chatService.stream(
        workspaceId,
        conversationId,
        user.sub,
        dto.content,
      )) {
        res.write(`event: ${event.type}\n`);
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stream failed';
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
      res.write(`event: done\n`);
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } finally {
      res.end();
    }
  }

  @Post('messages/:messageId/feedback')
  @RateLimit({ limit: 60, windowMs: 60_000 })
  @ApiOperation({ summary: 'Rate an assistant answer as helpful or not helpful' })
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  upsertFeedback(
    @Param('id') workspaceId: string,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpsertAnswerFeedbackDto,
  ): Promise<AnswerFeedbackResponseDto> {
    return this.answerFeedbackService.upsertFeedback({
      workspaceId,
      conversationId,
      messageId,
      userId: user.sub,
      rating: dto.rating,
    });
  }
}

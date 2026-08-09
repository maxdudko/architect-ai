import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
import { AnswerFeedbackService } from '../analytics/answer-feedback.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../common/guards/workspace-param.guard';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { ConversationsService } from './conversations.service';
import {
  ConversationDetailResponseDto,
  ConversationResponseDto,
} from './dto/conversation-response.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

@ApiTags('Conversation')
@ApiBearerAuth()
@Controller('workspaces/:id/conversations')
@UseGuards(JwtAuthGuard, WorkspaceParamGuard, RolesGuard)
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly answerFeedbackService: AnswerFeedbackService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a conversation in a workspace' })
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  createConversation(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateConversationDto,
  ): Promise<ConversationResponseDto> {
    return this.conversationsService.createConversation(
      workspaceId,
      user.sub,
      dto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List conversations in a workspace' })
  @Roles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.VIEWER,
  )
  listConversations(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<ConversationResponseDto[]> {
    return this.conversationsService.listConversations(workspaceId, user.sub);
  }

  @Get(':conversationId')
  @ApiOperation({ summary: 'Get a conversation with messages' })
  @Roles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.VIEWER,
  )
  async getConversation(
    @Param('id') workspaceId: string,
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<ConversationDetailResponseDto> {
    const detail = await this.conversationsService.getConversation(
      workspaceId,
      conversationId,
      user.sub,
    );
    const feedbackByMessageId =
      await this.answerFeedbackService.listRatingsForUser(
        detail.messages.map((message) => message.id),
        user.sub,
      );
    return {
      ...detail,
      messages: detail.messages.map((message) => ({
        ...message,
        feedbackRating: feedbackByMessageId.get(message.id) ?? null,
      })),
    };
  }

  @Patch(':conversationId')
  @ApiOperation({ summary: 'Update a conversation' })
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  updateConversation(
    @Param('id') workspaceId: string,
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateConversationDto,
  ): Promise<ConversationResponseDto> {
    return this.conversationsService.updateConversation(
      workspaceId,
      conversationId,
      user.sub,
      dto,
    );
  }

  @Delete(':conversationId')
  @ApiOperation({ summary: 'Soft-delete a conversation' })
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  deleteConversation(
    @Param('id') workspaceId: string,
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<{ success: boolean }> {
    return this.conversationsService.deleteConversation(
      workspaceId,
      conversationId,
      user.sub,
    );
  }
}

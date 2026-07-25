import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
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

@ApiTags('Conversation')
@ApiBearerAuth()
@Controller('workspaces/:id/conversations')
@UseGuards(JwtAuthGuard, WorkspaceParamGuard, RolesGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

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
  ): Promise<ConversationResponseDto[]> {
    return this.conversationsService.listConversations(workspaceId);
  }

  @Get(':conversationId')
  @ApiOperation({ summary: 'Get a conversation with messages' })
  @Roles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.VIEWER,
  )
  getConversation(
    @Param('id') workspaceId: string,
    @Param('conversationId') conversationId: string,
  ): Promise<ConversationDetailResponseDto> {
    return this.conversationsService.getConversation(
      workspaceId,
      conversationId,
    );
  }

  @Delete(':conversationId')
  @ApiOperation({ summary: 'Soft-delete a conversation' })
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  deleteConversation(
    @Param('id') workspaceId: string,
    @Param('conversationId') conversationId: string,
  ): Promise<{ success: boolean }> {
    return this.conversationsService.deleteConversation(
      workspaceId,
      conversationId,
    );
  }
}

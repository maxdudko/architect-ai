import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { UsersService } from '../../users/users.service';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import type { AdminJwtPayload } from '../auth/interfaces/admin-jwt-payload.interface';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { AdminUsersService } from './admin-users.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';

export interface AdminPublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  deletedAt: Date | null;
}

@ApiTags('Admin Users')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly adminUsersService: AdminUsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List platform users' })
  async list(@Query() query: ListUsersQueryDto): Promise<{
    items: AdminPublicUser[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { items, total } = await this.usersService.findManyPaginated({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      includeDeleted: query.includeDeleted,
    });

    return {
      items: items.map((user) => this.sanitizeUser(user)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  @Patch(':userId')
  @ApiOperation({
    summary: 'Update user profile fields (name, email, verification)',
  })
  async update(
    @Param('userId') userId: string,
    @Body() dto: UpdateAdminUserDto,
    @CurrentAdmin() admin: AdminJwtPayload,
  ): Promise<AdminPublicUser> {
    const user = await this.adminUsersService.updateUser(
      userId,
      dto,
      admin.sub,
    );
    return this.sanitizeUser(user);
  }

  @Post(':userId/ban')
  @ApiOperation({
    summary: 'Ban a user (soft-delete; blocks sign-in and revokes sessions)',
  })
  async ban(
    @Param('userId') userId: string,
    @CurrentAdmin() admin: AdminJwtPayload,
  ): Promise<AdminPublicUser> {
    const user = await this.adminUsersService.banUser(userId, admin.sub);
    return this.sanitizeUser(user);
  }

  @Post(':userId/unban')
  @ApiOperation({ summary: 'Unban a previously banned user' })
  async unban(
    @Param('userId') userId: string,
    @CurrentAdmin() admin: AdminJwtPayload,
  ): Promise<AdminPublicUser> {
    const user = await this.adminUsersService.unbanUser(userId, admin.sub);
    return this.sanitizeUser(user);
  }

  private sanitizeUser(user: User): AdminPublicUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      deletedAt: user.deletedAt,
    };
  }
}

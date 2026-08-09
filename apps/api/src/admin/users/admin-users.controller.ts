import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { UsersService } from '../../users/users.service';
import { AdminJwtAuthGuard } from '../guards/admin-jwt-auth.guard';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

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
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List platform users (read-only)' })
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

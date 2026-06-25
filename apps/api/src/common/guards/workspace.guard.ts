import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { MembershipsService } from '../../memberships/memberships.service';
import { RequestUser } from '../interfaces/request-user.interface';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private readonly membershipsService: MembershipsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: RequestUser;
      workspace?: { id: string; role: WorkspaceRole };
    }>();
    const user = request.user;

    if (!user?.activeWorkspaceId) {
      throw new ForbiddenException('No active workspace selected');
    }

    const membership = await this.membershipsService.resolveActiveMembership(
      user.activeWorkspaceId,
      user.sub,
    );

    request.workspace = {
      id: user.activeWorkspaceId,
      role: membership.role,
    };

    return true;
  }
}

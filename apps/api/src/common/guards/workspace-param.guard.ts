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
export class WorkspaceParamGuard implements CanActivate {
  constructor(private readonly membershipsService: MembershipsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: RequestUser;
      params?: { id?: string };
      workspace?: { id: string; role: WorkspaceRole };
    }>();
    const user = request.user;
    const workspaceId = request.params?.id;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (!workspaceId) {
      throw new ForbiddenException('Workspace id is missing from route');
    }

    const membership = await this.membershipsService.resolveActiveMembership(
      workspaceId,
      user.sub,
    );

    request.workspace = {
      id: workspaceId,
      role: membership.role,
    };

    return true;
  }
}

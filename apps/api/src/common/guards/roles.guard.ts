import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

const ROLE_WEIGHT: Record<WorkspaceRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ workspace?: { role?: WorkspaceRole } }>();
    const role = request.workspace?.role;

    if (!role) {
      throw new ForbiddenException(
        'Workspace role is missing in request context',
      );
    }

    const minimumRequiredWeight = Math.min(
      ...requiredRoles.map((requiredRole) => ROLE_WEIGHT[requiredRole]),
    );

    if (ROLE_WEIGHT[role] < minimumRequiredWeight) {
      throw new ForbiddenException(
        'You do not have sufficient role permissions for this action',
      );
    }

    return true;
  }
}

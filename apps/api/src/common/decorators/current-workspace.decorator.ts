import { WorkspaceRole } from '@prisma/client';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentWorkspace = createParamDecorator(
  (
    _: unknown,
    context: ExecutionContext,
  ): { id: string; role?: WorkspaceRole } => {
    const request = context
      .switchToHttp()
      .getRequest<{ workspace: { id: string; role?: WorkspaceRole } }>();
    return request.workspace;
  },
);

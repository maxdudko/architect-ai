import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminJwtPayload } from '../auth/interfaces/admin-jwt-payload.interface';

export const CurrentAdmin = createParamDecorator(
  (_: unknown, context: ExecutionContext): AdminJwtPayload => {
    const request = context
      .switchToHttp()
      .getRequest<{ user: AdminJwtPayload }>();
    return request.user;
  },
);

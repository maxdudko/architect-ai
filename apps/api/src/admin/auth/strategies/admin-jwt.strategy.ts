import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AdminJwtPayload } from '../interfaces/admin-jwt-payload.interface';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_ADMIN_ACCESS_SECRET') ??
        'dev-admin-access-secret',
    });
  }

  validate(payload: AdminJwtPayload): AdminJwtPayload {
    if (payload.tokenType !== 'admin') {
      throw new UnauthorizedException('Invalid admin access token');
    }
    return payload;
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { Admin, SystemLogCategory, SystemLogLevel } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { SystemLogsService } from '../../system-logs/system-logs.service';
import { AdminsService } from '../admins.service';
import { AdminSessionStoreService } from './admin-session-store.service';
import { AdminRefreshDto } from './dto/admin-refresh.dto';
import { AdminSignInDto } from './dto/admin-sign-in.dto';
import { AdminAuthResponse } from './interfaces/admin-auth-response.interface';
import { AdminJwtPayload } from './interfaces/admin-jwt-payload.interface';
import { AdminRefreshTokenPayload } from './interfaces/admin-refresh-token-payload.interface';
import { AdminTokenPair } from './interfaces/admin-token-pair.interface';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly adminsService: AdminsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionStoreService: AdminSessionStoreService,
    private readonly systemLogsService: SystemLogsService,
  ) {}

  async signIn(dto: AdminSignInDto): Promise<AdminAuthResponse> {
    const email = dto.email.toLowerCase();
    const admin = await this.adminsService.findByEmail(email);
    if (!admin) {
      this.systemLogsService.record({
        category: SystemLogCategory.AUDIT,
        level: SystemLogLevel.WARN,
        event: 'admin.auth.signin.failure',
        message: 'Invalid email or password',
        metadata: { email },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValidPassword = await bcrypt.compare(
      dto.password,
      admin.passwordHash,
    );
    if (!isValidPassword) {
      this.systemLogsService.record({
        category: SystemLogCategory.AUDIT,
        level: SystemLogLevel.WARN,
        event: 'admin.auth.signin.failure',
        actorType: 'admin',
        actorId: admin.id,
        message: 'Invalid email or password',
        metadata: { email },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const authenticatedAdmin = await this.adminsService.touchLastLoginAt(
      admin.id,
    );

    this.systemLogsService.record({
      category: SystemLogCategory.AUDIT,
      level: SystemLogLevel.INFO,
      event: 'admin.auth.signin.success',
      actorType: 'admin',
      actorId: authenticatedAdmin.id,
      message: 'Admin signed in',
      metadata: { email: authenticatedAdmin.email },
    });

    return this.buildAuthResponse(authenticatedAdmin);
  }

  async refresh(dto: AdminRefreshDto): Promise<AdminTokenPair> {
    if (!dto.refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const payload = await this.verifyRefreshToken(dto.refreshToken);

    const isStored = await this.sessionStoreService.hasRefreshToken(
      payload.sub,
      dto.refreshToken,
    );
    if (!isStored) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const admin = await this.adminsService.findById(payload.sub);
    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    await this.sessionStoreService.removeRefreshToken(
      admin.id,
      dto.refreshToken,
    );

    const tokens = await this.issueTokens({
      sub: admin.id,
      email: admin.email,
      tokenType: 'admin',
    });

    await this.sessionStoreService.addRefreshToken(
      admin.id,
      tokens.refreshToken,
    );

    return tokens;
  }

  async logout(
    adminId: string,
    refreshToken?: string,
  ): Promise<{ success: boolean }> {
    await this.sessionStoreService.removeRefreshToken(adminId, refreshToken);
    this.systemLogsService.record({
      category: SystemLogCategory.AUDIT,
      level: SystemLogLevel.INFO,
      event: 'admin.auth.logout',
      actorType: 'admin',
      actorId: adminId,
      message: 'Admin logged out',
    });
    return { success: true };
  }

  async me(adminId: string): Promise<Pick<AdminAuthResponse, 'admin'>> {
    const admin = await this.adminsService.findById(adminId);
    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    return { admin: this.sanitizeAdmin(admin) };
  }

  private async buildAuthResponse(admin: Admin): Promise<AdminAuthResponse> {
    const tokens = await this.issueTokens({
      sub: admin.id,
      email: admin.email,
      tokenType: 'admin',
    });

    await this.sessionStoreService.addRefreshToken(
      admin.id,
      tokens.refreshToken,
    );

    return {
      ...tokens,
      admin: this.sanitizeAdmin(admin),
    };
  }

  private async issueTokens(payload: AdminJwtPayload): Promise<AdminTokenPair> {
    const accessTtl = this.getJwtTtl('JWT_ADMIN_ACCESS_TTL', '15m');
    const accessToken = await this.jwtService.signAsync(payload, {
      secret:
        this.configService.get<string>('JWT_ADMIN_ACCESS_SECRET') ??
        'dev-admin-access-secret',
      expiresIn: accessTtl,
    });

    const refreshTtl = this.getJwtTtl('JWT_ADMIN_REFRESH_TTL', '30d');
    const refreshToken = await this.jwtService.signAsync(
      {
        sub: payload.sub,
        email: payload.email,
        tokenType: 'admin-refresh',
      } satisfies AdminRefreshTokenPayload,
      {
        secret:
          this.configService.get<string>('JWT_ADMIN_REFRESH_SECRET') ??
          'dev-admin-refresh-secret',
        expiresIn: refreshTtl,
      },
    );

    return { accessToken, refreshToken };
  }

  private sanitizeAdmin(admin: Admin): AdminAuthResponse['admin'] {
    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      lastLoginAt: admin.lastLoginAt,
    };
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<AdminRefreshTokenPayload> {
    try {
      const payload =
        await this.jwtService.verifyAsync<AdminRefreshTokenPayload>(
          refreshToken,
          {
            secret:
              this.configService.get<string>('JWT_ADMIN_REFRESH_SECRET') ??
              'dev-admin-refresh-secret',
          },
        );

      if (payload.tokenType !== 'admin-refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private getJwtTtl(
    key: string,
    fallback: NonNullable<JwtSignOptions['expiresIn']>,
  ): NonNullable<JwtSignOptions['expiresIn']> {
    const value = this.configService.get<string>(key);
    return value
      ? (value as NonNullable<JwtSignOptions['expiresIn']>)
      : fallback;
  }
}

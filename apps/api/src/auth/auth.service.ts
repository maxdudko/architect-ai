import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { User, WorkspaceRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { UsersService } from '../users/users.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { RefreshDto } from './dto/refresh.dto';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { AuthResponse } from './interfaces/auth-response.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { RefreshTokenPayload } from './interfaces/refresh-token-payload.interface';
import { TokenPair } from './interfaces/token-pair.interface';
import { SessionStoreService } from './session-store.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly workspacesService: WorkspacesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionStoreService: SessionStoreService,
  ) {}

  async signUp(dto: SignUpDto): Promise<AuthResponse> {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      emailVerified: false,
      lastLoginAt: new Date(),
    });

    const personalWorkspace =
      await this.workspacesService.createPersonalWorkspace(
        user.id,
        user.firstName,
      );

    return this.buildAuthResponse(user, personalWorkspace.id);
  }

  async signIn(dto: SignInDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.email.toLowerCase());
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValidPassword = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const authenticatedUser = await this.usersService.touchLastLoginAt(user.id);

    const workspaces = await this.workspacesService.listForUser(
      authenticatedUser.id,
    );
    if (workspaces.length === 0) {
      throw new NotFoundException(
        'No workspace memberships found for this user',
      );
    }

    return this.buildAuthResponse(authenticatedUser, workspaces[0].id);
  }

  async switchActiveWorkspace(
    userId: string,
    email: string,
    workspaceId: string,
    refreshToken: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    activeWorkspace: {
      id: string;
      name: string;
      slug: string;
      role: WorkspaceRole;
    };
  }> {
    const { workspace, role } =
      await this.workspacesService.getWorkspaceForUser(workspaceId, userId);

    const payload = await this.verifyRefreshToken(refreshToken);
    if (payload.sub !== userId) {
      throw new UnauthorizedException('Refresh token does not match user');
    }

    const isStored = await this.sessionStoreService.hasRefreshToken(
      userId,
      refreshToken,
    );
    if (!isStored) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const tokens = await this.issueTokens({
      sub: userId,
      email,
      activeWorkspaceId: workspace.id,
    });

    await this.sessionStoreService.removeRefreshToken(userId, refreshToken);
    await this.sessionStoreService.addRefreshToken(userId, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      activeWorkspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role,
      },
    };
  }

  async refresh(dto: RefreshDto): Promise<TokenPair> {
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

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const activeWorkspaceId = await this.resolveActiveWorkspaceId(
      user.id,
      dto.activeWorkspaceId ?? payload.activeWorkspaceId,
    );

    await this.sessionStoreService.removeRefreshToken(
      user.id,
      dto.refreshToken,
    );

    const tokens = await this.issueTokens({
      sub: user.id,
      email: user.email,
      activeWorkspaceId,
    });

    await this.sessionStoreService.addRefreshToken(
      user.id,
      tokens.refreshToken,
    );

    return tokens;
  }

  async logout(
    userId: string,
    refreshToken?: string,
  ): Promise<{ success: boolean }> {
    await this.sessionStoreService.removeRefreshToken(userId, refreshToken);
    return { success: true };
  }

  async createSessionForUser(
    userId: string,
    activeWorkspaceId: string,
  ): Promise<AuthResponse> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const authenticatedUser = await this.usersService.touchLastLoginAt(user.id);
    return this.buildAuthResponse(authenticatedUser, activeWorkspaceId);
  }

  async me(
    user: RequestUser,
  ): Promise<Pick<AuthResponse, 'user' | 'workspaces' | 'activeWorkspace'>> {
    const databaseUser = await this.usersService.findById(user.sub);
    if (!databaseUser) {
      throw new UnauthorizedException('User not found');
    }

    return this.buildUserContext(databaseUser, user.activeWorkspaceId);
  }

  private async buildAuthResponse(
    user: User,
    activeWorkspaceId: string,
  ): Promise<AuthResponse> {
    const context = await this.buildUserContext(user, activeWorkspaceId);

    const tokens = await this.issueTokens({
      sub: user.id,
      email: user.email,
      activeWorkspaceId: context.activeWorkspace.id,
    });

    await this.sessionStoreService.addRefreshToken(
      user.id,
      tokens.refreshToken,
    );

    return {
      ...tokens,
      ...context,
    };
  }

  private async buildUserContext(
    user: User,
    activeWorkspaceId: string,
  ): Promise<Pick<AuthResponse, 'user' | 'workspaces' | 'activeWorkspace'>> {
    const workspaces = await this.workspacesService.listForUser(user.id);
    const activeWorkspace =
      workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
      workspaces[0];

    return {
      user: this.sanitizeUser(user),
      workspaces: workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role: workspace.role,
      })),
      activeWorkspace: {
        id: activeWorkspace.id,
        name: activeWorkspace.name,
        slug: activeWorkspace.slug,
        role: activeWorkspace.role,
      },
    };
  }

  private async issueTokens(payload: JwtPayload): Promise<TokenPair> {
    const accessTtl = this.getJwtTtl('JWT_ACCESS_TTL', '15m');
    const accessToken = await this.jwtService.signAsync(payload, {
      secret:
        this.configService.get<string>('JWT_ACCESS_SECRET') ??
        'dev-access-secret',
      expiresIn: accessTtl,
    });

    const refreshTtl = this.getJwtTtl('JWT_REFRESH_TTL', '30d');
    const refreshToken = await this.jwtService.signAsync(
      {
        sub: payload.sub,
        email: payload.email,
        tokenType: 'refresh',
        activeWorkspaceId: payload.activeWorkspaceId,
      },
      {
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ??
          'dev-refresh-secret',
        expiresIn: refreshTtl,
      },
    );

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: User): AuthResponse['user'] {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      lastLoginAt: user.lastLoginAt,
    };
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret:
            this.configService.get<string>('JWT_REFRESH_SECRET') ??
            'dev-refresh-secret',
        },
      );

      if (payload.tokenType !== 'refresh') {
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

  private async resolveActiveWorkspaceId(
    userId: string,
    preferredWorkspaceId?: string,
  ): Promise<string> {
    const workspaces = await this.workspacesService.listForUser(userId);
    if (workspaces.length === 0) {
      throw new NotFoundException(
        'No workspace memberships found for this user',
      );
    }

    if (!preferredWorkspaceId) {
      return workspaces[0].id;
    }

    const match = workspaces.find(
      (workspace) => workspace.id === preferredWorkspaceId,
    );
    if (!match) {
      throw new ForbiddenException(
        'No active membership in the requested workspace',
      );
    }

    return match.id;
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

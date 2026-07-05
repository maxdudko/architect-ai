import { forwardRef, Module } from '@nestjs/common';
import { RepositoriesModule } from '../../repositories/repositories.module';
import { WorkspacesModule } from '../../workspaces/workspaces.module';
import { GithubAccountsRepository } from './github-accounts.repository';
import { GithubAccessTokenService } from './github-access-token.service';
import { GithubHttpService } from './github-http.service';
import { GithubIntegrationController } from './github-integration.controller';
import { GithubIntegrationService } from './github-integration.service';
import { GithubOauthStateService } from './github-oauth-state.service';
import { GithubTokenCipherService } from './github-token-cipher.service';

@Module({
  imports: [WorkspacesModule, forwardRef(() => RepositoriesModule)],
  controllers: [GithubIntegrationController],
  providers: [
    GithubAccountsRepository,
    GithubAccessTokenService,
    GithubHttpService,
    GithubIntegrationService,
    GithubOauthStateService,
    GithubTokenCipherService,
  ],
  exports: [
    GithubIntegrationService,
    GithubTokenCipherService,
    GithubAccountsRepository,
    GithubAccessTokenService,
    GithubHttpService,
  ],
})
export class GithubIntegrationModule {}

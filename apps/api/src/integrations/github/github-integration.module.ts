import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../../repositories/repositories.module';
import { WorkspacesModule } from '../../workspaces/workspaces.module';
import { GithubAccountsRepository } from './github-accounts.repository';
import { GithubHttpService } from './github-http.service';
import { GithubIntegrationController } from './github-integration.controller';
import { GithubIntegrationService } from './github-integration.service';
import { GithubOauthStateService } from './github-oauth-state.service';
import { GithubTokenCipherService } from './github-token-cipher.service';

@Module({
  imports: [WorkspacesModule, RepositoriesModule],
  controllers: [GithubIntegrationController],
  providers: [
    GithubAccountsRepository,
    GithubHttpService,
    GithubIntegrationService,
    GithubOauthStateService,
    GithubTokenCipherService,
  ],
  exports: [GithubIntegrationService, GithubTokenCipherService],
})
export class GithubIntegrationModule {}

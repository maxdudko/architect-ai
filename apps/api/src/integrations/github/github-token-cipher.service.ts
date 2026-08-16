import { Injectable } from '@nestjs/common';
import { TokenCipherService } from '../../common/crypto/token-cipher.service';

@Injectable()
export class GithubTokenCipherService extends TokenCipherService {}

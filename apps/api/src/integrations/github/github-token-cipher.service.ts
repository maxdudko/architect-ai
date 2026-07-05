import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const IV_LENGTH = 12;

@Injectable()
export class GithubTokenCipherService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const secret =
      this.configService.get<string>('TOKEN_ENCRYPTION_KEY') ??
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      'architect-ai-dev-token-encryption-key';
    this.key = createHash('sha256').update(secret).digest();
  }

  encrypt(plaintext: string): string {
    if (!plaintext) {
      throw new BadRequestException('Token cannot be empty');
    }

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [iv, authTag, ciphertext]
      .map((value) => value.toString('base64url'))
      .join('.');
  }

  decrypt(payload: string): string {
    const [ivEncoded, tagEncoded, ciphertextEncoded] = payload.split('.');
    if (!ivEncoded || !tagEncoded || !ciphertextEncoded) {
      throw new InternalServerErrorException('Stored token payload is invalid');
    }

    try {
      const iv = Buffer.from(ivEncoded, 'base64url');
      const authTag = Buffer.from(tagEncoded, 'base64url');
      const ciphertext = Buffer.from(ciphertextEncoded, 'base64url');
      const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      return plaintext.toString('utf8');
    } catch {
      throw new InternalServerErrorException('Failed to decrypt stored token');
    }
  }
}

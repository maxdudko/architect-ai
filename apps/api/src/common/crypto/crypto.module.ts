import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TokenCipherService } from './token-cipher.service';

@Module({
  imports: [ConfigModule],
  providers: [TokenCipherService],
  exports: [TokenCipherService],
})
export class CryptoModule {}

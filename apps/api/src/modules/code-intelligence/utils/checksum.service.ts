import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

@Injectable()
export class ChecksumService {
  async hashFile(absolutePath: string): Promise<string> {
    const hash = createHash('sha256');

    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(absolutePath);
      stream.on('data', (chunk: Buffer | string) => {
        hash.update(chunk);
      });
      stream.on('end', () => resolve());
      stream.on('error', (error) => reject(error));
    });

    return hash.digest('hex');
  }
}

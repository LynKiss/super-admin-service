import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

@Injectable()
export class SecretVaultService {
  constructor(private readonly configService: ConfigService) {}

  encrypt(value: string) {
    const key = this.getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join('.');
  }

  decrypt(ciphertext: string) {
    const [ivRaw, tagRaw, encryptedRaw] = ciphertext.split('.');
    if (!ivRaw || !tagRaw || !encryptedRaw) {
      throw new InternalServerErrorException('Encrypted project secret is invalid');
    }

    const decipher = createDecipheriv('aes-256-gcm', this.getKey(), Buffer.from(ivRaw, 'base64'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private getKey() {
    const secret = this.configService.get<string>('SUPER_ADMIN_SECRET_ENCRYPTION_KEY');
    if (!secret || secret.length < 32) {
      throw new InternalServerErrorException(
        'SUPER_ADMIN_SECRET_ENCRYPTION_KEY must be at least 32 characters',
      );
    }

    return createHash('sha256').update(secret).digest();
  }
}

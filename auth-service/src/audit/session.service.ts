import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { RefreshToken } from '../entities/refresh-token.entity';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(RefreshToken) private refreshTokenRepo: Repository<RefreshToken>,
    @Inject('REDIS_CLIENT') private redis: Redis,
  ) {}

  async getActiveSessions(userId: string) {
    const tokens = await this.refreshTokenRepo.find({
      where: { userId, isRevoked: false },
      order: { createdAt: 'DESC' },
    });
    return tokens
      .filter((t) => t.expiresAt > new Date())
      .map((t) => ({
        id: t.id,
        clientType: t.clientType,
        deviceInfo: t.deviceInfo,
        ipAddress: t.ipAddress,
        createdAt: t.createdAt,
        expiresAt: t.expiresAt,
        rotationCounter: t.rotationCounter,
      }));
  }

  async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    const token = await this.refreshTokenRepo.findOne({
      where: { id: sessionId, userId, isRevoked: false },
    });
    if (!token) return false;

    await this.refreshTokenRepo.update(token.id, {
      isRevoked: true,
      revokedAt: new Date(),
    });
    await this.redis.setex(`blacklist:${token.id}`, 7 * 24 * 3600, '1');
    return true;
  }

  async countActiveSessions(userId: string): Promise<number> {
    const sessions = await this.getActiveSessions(userId);
    return sessions.length;
  }
}

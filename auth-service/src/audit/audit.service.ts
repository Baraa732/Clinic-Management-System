import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from '../entities/audit-log.entity';

export interface AuditContext {
  userId?: string | null;
  email?: string | null;
  ipAddress: string;
  userAgent?: string | null;
  clientType?: string | null;
  sessionId?: string | null;
  success?: boolean;
  details?: string | null;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async log(action: AuditAction, ctx: AuditContext): Promise<void> {
    const entry = this.auditRepo.create({
      action,
      userId: ctx.userId ?? null,
      email: ctx.email ?? null,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent ?? null,
      clientType: ctx.clientType ?? null,
      sessionId: ctx.sessionId ?? null,
      success: ctx.success ?? true,
      details: ctx.details ?? null,
    });
    await this.auditRepo.save(entry).catch(() => {/* non-blocking */});
  }
}

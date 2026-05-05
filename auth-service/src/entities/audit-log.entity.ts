import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, BeforeInsert, Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

export enum AuditAction {
  REGISTER            = 'REGISTER',
  LOGIN_SUCCESS        = 'LOGIN_SUCCESS',
  LOGIN_FAILED         = 'LOGIN_FAILED',
  LOGOUT              = 'LOGOUT',
  LOGOUT_ALL          = 'LOGOUT_ALL',
  TOKEN_REFRESH        = 'TOKEN_REFRESH',
  TOKEN_REUSE_DETECTED = 'TOKEN_REUSE_DETECTED',
  EMAIL_VERIFIED       = 'EMAIL_VERIFIED',
  EMAIL_VERIFY_RESENT  = 'EMAIL_VERIFY_RESENT',
  PASSWORD_CHANGED     = 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQ   = 'PASSWORD_RESET_REQ',
  PASSWORD_RESET_DONE  = 'PASSWORD_RESET_DONE',
  ACCOUNT_LOCKED       = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED     = 'ACCOUNT_UNLOCKED',
  SESSION_REVOKED      = 'SESSION_REVOKED',
  ADMIN_REVOKE_SESSIONS = 'ADMIN_REVOKE_SESSIONS',
  SUSPICIOUS_ACTIVITY  = 'SUSPICIOUS_ACTIVITY',
}

@Entity('audit_logs')
@Index('idx_audit_userId', ['userId'])
@Index('idx_audit_action', ['action'])
@Index('idx_audit_created', ['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email: string | null;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'varchar', length: 45 })
  ipAddress: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  clientType: string | null;

  @Column({ default: true })
  success: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  details: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  sessionId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  generateId() { if (!this.id) this.id = uuidv4(); }
}

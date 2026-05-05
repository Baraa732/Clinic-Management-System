import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  BeforeInsert,
  Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { UserRole, ClientType, AccountStatus } from '../common/enums/user.enum';
import { RefreshToken } from './refresh-token.entity';
import { LoginAttempt } from './login-attempt.entity';

@Entity('users')
@Index('idx_users_email', ['email'])
@Index('idx_users_status', ['status'])
@Index('idx_users_reset_expires', ['passwordResetExpires'])
@Index('idx_users_verification_status', ['isEmailVerified', 'status'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 100 })
  email: string;

  @Column({ length: 255 })
  password: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ type: 'enum', enum: ClientType })
  clientType: ClientType;

  @Column({ type: 'enum', enum: AccountStatus, default: AccountStatus.PENDING_VERIFICATION })
  status: AccountStatus;

  @Column({ length: 100 })
  firstName: string;

  @Column({ length: 100 })
  lastName: string;

  @Column({ unique: false, length: 20, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  emailVerificationToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  emailVerificationExpires: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordResetToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  passwordResetExpires: Date | null;

  @Column({ name: 'failed_login_attempts', default: 0 })
  loginAttempts: number;

  // Tracks how many times the account has been locked — used for progressive backoff
  @Column({ default: 0 })
  lockoutCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lockedUntil: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  lastLoginIp: string;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ default: true })
  isActive: boolean;

  // Incremented on password change / logout-all — embedded in JWT for fast global invalidation
  @Column({ default: 0 })
  tokenVersion: number;

  @Column({ default: 0 })
  resendVerificationCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lastResendAt: Date | null;

  @OneToMany(() => RefreshToken, (token) => token.user, { cascade: true })
  refreshTokens: RefreshToken[];

  @OneToMany(() => LoginAttempt, (attempt) => attempt.user, { cascade: true })
  loginHistory: LoginAttempt[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}

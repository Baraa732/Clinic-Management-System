import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { User } from './user.entity';
import { ClientType } from '../common/enums/user.enum';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 512 })
  tokenHash: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: ClientType })
  clientType: ClientType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceInfo: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string;

  @Column()
  expiresAt: Date;

  @Column({ default: false })
  isRevoked: boolean;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date;

  @Column({ type: 'varchar', length: 512, nullable: true })
  replacedByToken: string;

  // rotation generation — increments on every refresh
  @Column({ default: 0 })
  rotationCounter: number;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }
}

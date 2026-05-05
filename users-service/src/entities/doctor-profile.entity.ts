import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('doctor_profiles')
export class DoctorProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @Column({ length: 100 })
  firstName: string;

  @Column({ length: 100 })
  lastName: string;

  @Column({ unique: true, length: 100 })
  email: string;

  @Column({ nullable: true, length: 20 })
  phone: string;

  @Column({ nullable: true, length: 150 })
  specialization: string;

  @Column({ nullable: true, length: 100 })
  licenseNumber: string;

  @Column({ nullable: true, length: 100 })
  department: string;

  @Column({ nullable: true, type: 'text' })
  bio: string;

  @Column({ nullable: true, length: 255 })
  profilePicture: string;

  @Column({ nullable: true })
  yearsOfExperience: number;

  @Column({ default: true })
  isAvailable: boolean;

  @Column({ nullable: true, type: 'json' })
  workingHours: object;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() { if (!this.id) this.id = uuidv4(); }
}

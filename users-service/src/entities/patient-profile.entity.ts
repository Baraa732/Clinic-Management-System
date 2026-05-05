import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('patient_profiles')
export class PatientProfile {
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

  @Column({ nullable: true, type: 'date' })
  dateOfBirth: Date;

  @Column({ nullable: true, length: 10 })
  gender: string;

  @Column({ nullable: true, type: 'text' })
  address: string;

  @Column({ nullable: true, length: 10 })
  bloodType: string;

  @Column({ nullable: true, type: 'text' })
  allergies: string;

  @Column({ nullable: true, type: 'text' })
  medicalHistory: string;

  @Column({ nullable: true, length: 100 })
  emergencyContactName: string;

  @Column({ nullable: true, length: 20 })
  emergencyContactPhone: string;

  @Column({ nullable: true, length: 255 })
  profilePicture: string;

  @Column({ nullable: true, length: 100 })
  insuranceProvider: string;

  @Column({ nullable: true, length: 100 })
  insuranceNumber: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() { if (!this.id) this.id = uuidv4(); }
}

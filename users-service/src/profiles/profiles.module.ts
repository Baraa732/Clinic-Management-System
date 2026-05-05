import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesService } from './profiles.service';
import { ProfilesController } from './profiles.controller';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { AdminProfile } from '../entities/admin-profile.entity';
import { SecretaryProfile } from '../entities/secretary-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DoctorProfile, PatientProfile, AdminProfile, SecretaryProfile])],
  controllers: [ProfilesController],
  providers: [ProfilesService],
})
export class ProfilesModule {}

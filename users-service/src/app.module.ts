import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesModule } from './profiles/profiles.module';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { PatientProfile } from './entities/patient-profile.entity';
import { AdminProfile } from './entities/admin-profile.entity';
import { SecretaryProfile } from './entities/secretary-profile.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get('DATABASE_URL'),
        entities: [DoctorProfile, PatientProfile, AdminProfile, SecretaryProfile],
        synchronize: true,
        ssl: { rejectUnauthorized: false },
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
    ProfilesModule,
  ],
})
export class AppModule {}

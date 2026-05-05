import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { DoctorProfile } from '../entities/doctor-profile.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { AdminProfile } from '../entities/admin-profile.entity';
import { SecretaryProfile } from '../entities/secretary-profile.entity';
import { UserRole } from '../common/enums/user.enum';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(DoctorProfile) private doctorRepo: Repository<DoctorProfile>,
    @InjectRepository(PatientProfile) private patientRepo: Repository<PatientProfile>,
    @InjectRepository(AdminProfile) private adminRepo: Repository<AdminProfile>,
    @InjectRepository(SecretaryProfile) private secretaryRepo: Repository<SecretaryProfile>,
  ) {}

  private rpc(exception: any): RpcException {
    const res = exception.getResponse?.() as any;
    return new RpcException({
      statusCode: exception.getStatus?.() ?? 500,
      error: res?.error ?? exception.name,
      message: res?.message ?? exception.message,
    });
  }

  async createProfile(data: {
    userId: string; role: UserRole; firstName: string;
    lastName: string; email: string; phone?: string;
  }) {
    switch (data.role) {
      case UserRole.DOCTOR:
        await this.ensureNoDuplicate(this.doctorRepo, data.userId);
        return this.doctorRepo.save(this.doctorRepo.create(data));
      case UserRole.PATIENT:
        await this.ensureNoDuplicate(this.patientRepo, data.userId);
        return this.patientRepo.save(this.patientRepo.create(data));
      case UserRole.CLINIC_ADMIN:
        await this.ensureNoDuplicate(this.adminRepo, data.userId);
        return this.adminRepo.save(this.adminRepo.create(data));
      case UserRole.SECRETARY:
        await this.ensureNoDuplicate(this.secretaryRepo, data.userId);
        return this.secretaryRepo.save(this.secretaryRepo.create(data));
    }
  }

  async getProfile(userId: string, role: UserRole) {
    const profile = await this.getRepoByRole(role).findOne({ where: { userId } });
    if (!profile) throw this.rpc(new NotFoundException('Profile not found'));
    return profile;
  }

  async updateProfile(userId: string, role: UserRole, updateData: any) {
    const repo = this.getRepoByRole(role);
    const profile = await repo.findOne({ where: { userId } });
    if (!profile) throw this.rpc(new NotFoundException('Profile not found'));
    Object.assign(profile, updateData);
    return repo.save(profile);
  }

  async getDoctors(page = 1, limit = 10) {
    const [data, total] = await this.doctorRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getPatients(page = 1, limit = 10) {
    const [data, total] = await this.patientRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async searchDoctors(query: string) {
    return this.doctorRepo
      .createQueryBuilder('d')
      .where('d.firstName LIKE :q OR d.lastName LIKE :q OR d.specialization LIKE :q', { q: `%${query}%` })
      .getMany();
  }

  private getRepoByRole(role: UserRole): Repository<any> {
    const map = {
      [UserRole.DOCTOR]: this.doctorRepo,
      [UserRole.PATIENT]: this.patientRepo,
      [UserRole.CLINIC_ADMIN]: this.adminRepo,
      [UserRole.SECRETARY]: this.secretaryRepo,
    };
    return map[role];
  }

  private async ensureNoDuplicate(repo: Repository<any>, userId: string) {
    const existing = await repo.findOne({ where: { userId } });
    if (existing) throw this.rpc(new ConflictException('Profile already exists for this user'));
  }
}

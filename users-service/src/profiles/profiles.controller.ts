import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProfilesService } from './profiles.service';
import { UserRole } from '../common/enums/user.enum';

@Controller()
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @MessagePattern({ cmd: 'profile_create' })
  createProfile(@Payload() data: any) {
    return this.profilesService.createProfile(data);
  }

  @MessagePattern({ cmd: 'profile_get' })
  getProfile(@Payload() data: { userId: string; role: UserRole }) {
    return this.profilesService.getProfile(data.userId, data.role);
  }

  @MessagePattern({ cmd: 'profile_update' })
  updateProfile(@Payload() data: { userId: string; role: UserRole; updateData: any }) {
    return this.profilesService.updateProfile(data.userId, data.role, data.updateData);
  }

  @MessagePattern({ cmd: 'profile_get_doctors' })
  getDoctors(@Payload() data: { page?: number; limit?: number }) {
    return this.profilesService.getDoctors(data.page, data.limit);
  }

  @MessagePattern({ cmd: 'profile_get_patients' })
  getPatients(@Payload() data: { page?: number; limit?: number }) {
    return this.profilesService.getPatients(data.page, data.limit);
  }

  @MessagePattern({ cmd: 'profile_search_doctors' })
  searchDoctors(@Payload() data: { query: string }) {
    return this.profilesService.searchDoctors(data.query);
  }
}

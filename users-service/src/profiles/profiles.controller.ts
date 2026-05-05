import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { UserRole } from '../common/enums/user.enum';

@Controller('internal/users')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Post('profile')
  createProfile(@Body() data: any) {
    return this.profilesService.createProfile(data);
  }

  @Get('profile/:userId')
  getProfile(@Param('userId') userId: string, @Query('role') role: UserRole) {
    return this.profilesService.getProfile(userId, role);
  }

  @Patch('profile/:userId')
  updateProfile(@Param('userId') userId: string, @Query('role') role: UserRole, @Body() updateData: any) {
    return this.profilesService.updateProfile(userId, role, updateData);
  }

  @Get('doctors')
  getDoctors(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.profilesService.getDoctors(+page, +limit);
  }

  @Get('patients')
  getPatients(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.profilesService.getPatients(+page, +limit);
  }

  @Get('doctors/search')
  searchDoctors(@Query('q') query: string) {
    return this.profilesService.searchDoctors(query);
  }
}

import {
  Controller, Get, Patch, Body, UseGuards,
  Query, Param, HttpCode, HttpStatus,
  BadRequestException, ConflictException, ForbiddenException,
  NotFoundException, UnauthorizedException, InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ClientTypeGuard } from '../common/guards/client-type.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AllowedClients } from '../common/decorators/client-type.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole, ClientType } from '../common/enums/user.enum';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, ClientTypeGuard)
export class UsersController {
  private usersUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    const host = this.config.get('USERS_SERVICE_HOST', 'localhost');
    const port = this.config.get('USERS_SERVICE_PORT', '4002');
    this.usersUrl = `http://${host}:${port}/internal/users`;
  }

  private async call(method: 'get' | 'patch', path: string, data?: any) {
    try {
      const res = method === 'get'
        ? await firstValueFrom(this.http.get(`${this.usersUrl}${path}`))
        : await firstValueFrom(this.http.patch(`${this.usersUrl}${path}`, data));
      return res.data;
    } catch (err) {
      throw this.mapError(err?.response?.data || err);
    }
  }

  @Get('profile')
  getMyProfile(@CurrentUser() user: any) {
    return this.call('get', `/profile/${user.sub}?role=${user.role}`);
  }

  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  updateMyProfile(@CurrentUser() user: any, @Body() updateData: any) {
    return this.call('patch', `/profile/${user.sub}?role=${user.role}`, updateData);
  }

  @Get('doctors')
  @Roles(UserRole.CLINIC_ADMIN, UserRole.SECRETARY, UserRole.PATIENT)
  getDoctors(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.call('get', `/doctors?page=${page}&limit=${limit}`);
  }

  @Get('doctors/search')
  @Roles(UserRole.CLINIC_ADMIN, UserRole.SECRETARY, UserRole.PATIENT)
  searchDoctors(@Query('q') query: string) {
    return this.call('get', `/doctors/search?q=${query}`);
  }

  @Get('doctors/:userId')
  @Roles(UserRole.CLINIC_ADMIN, UserRole.SECRETARY)
  getDoctorById(@Param('userId') userId: string) {
    return this.call('get', `/profile/${userId}?role=${UserRole.DOCTOR}`);
  }

  @Get('patients')
  @Roles(UserRole.CLINIC_ADMIN, UserRole.SECRETARY, UserRole.DOCTOR)
  getPatients(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.call('get', `/patients?page=${page}&limit=${limit}`);
  }

  @Get('patients/:userId')
  @Roles(UserRole.CLINIC_ADMIN, UserRole.SECRETARY, UserRole.DOCTOR)
  getPatientById(@Param('userId') userId: string) {
    return this.call('get', `/profile/${userId}?role=${UserRole.PATIENT}`);
  }

  @Get('doctor/dashboard')
  @Roles(UserRole.DOCTOR)
  @AllowedClients(ClientType.MOBILE_DOCTOR)
  doctorDashboard(@CurrentUser() user: any) {
    return this.call('get', `/profile/${user.sub}?role=${UserRole.DOCTOR}`);
  }

  @Get('patient/dashboard')
  @Roles(UserRole.PATIENT)
  @AllowedClients(ClientType.MOBILE_PATIENT)
  patientDashboard(@CurrentUser() user: any) {
    return this.call('get', `/profile/${user.sub}?role=${UserRole.PATIENT}`);
  }

  @Get('admin/dashboard')
  @Roles(UserRole.CLINIC_ADMIN)
  @AllowedClients(ClientType.WEB_ADMIN)
  adminDashboard(@CurrentUser() user: any) {
    return this.call('get', `/profile/${user.sub}?role=${UserRole.CLINIC_ADMIN}`);
  }

  @Get('secretary/dashboard')
  @Roles(UserRole.SECRETARY)
  @AllowedClients(ClientType.WEB_SECRETARY)
  secretaryDashboard(@CurrentUser() user: any) {
    return this.call('get', `/profile/${user.sub}?role=${UserRole.SECRETARY}`);
  }

  private mapError(err: any) {
    const message = err?.message || 'An error occurred';
    const status = err?.statusCode || err?.status;
    if (status === 400 || err?.error === 'Bad Request') return new BadRequestException(message);
    if (status === 401 || err?.error === 'Unauthorized') return new UnauthorizedException(message);
    if (status === 403 || err?.error === 'Forbidden') return new ForbiddenException(message);
    if (status === 404 || err?.error === 'Not Found') return new NotFoundException(message);
    if (status === 409 || err?.error === 'Conflict') return new ConflictException(message);
    return new InternalServerErrorException(message);
  }
}

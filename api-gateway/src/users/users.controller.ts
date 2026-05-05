import {
  Controller, Get, Patch, Body, UseGuards,
  Query, Param, HttpCode, HttpStatus, Inject,
  BadRequestException, ConflictException, ForbiddenException,
  NotFoundException, UnauthorizedException, InternalServerErrorException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
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
  constructor(@Inject('USERS_SERVICE') private usersClient: ClientProxy) {}

  @Get('profile')
  async getMyProfile(@CurrentUser() user: any) {
    return firstValueFrom(
      this.usersClient.send({ cmd: 'profile_get' }, { userId: user.sub, role: user.role })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  async updateMyProfile(@CurrentUser() user: any, @Body() updateData: any) {
    return firstValueFrom(
      this.usersClient.send({ cmd: 'profile_update' }, { userId: user.sub, role: user.role, updateData })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Get('doctors')
  @Roles(UserRole.CLINIC_ADMIN, UserRole.SECRETARY, UserRole.PATIENT)
  async getDoctors(@Query('page') page = 1, @Query('limit') limit = 10) {
    return firstValueFrom(
      this.usersClient.send({ cmd: 'profile_get_doctors' }, { page: +page, limit: +limit })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Get('doctors/search')
  @Roles(UserRole.CLINIC_ADMIN, UserRole.SECRETARY, UserRole.PATIENT)
  async searchDoctors(@Query('q') query: string) {
    return firstValueFrom(
      this.usersClient.send({ cmd: 'profile_search_doctors' }, { query })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Get('doctors/:userId')
  @Roles(UserRole.CLINIC_ADMIN, UserRole.SECRETARY)
  async getDoctorById(@Param('userId') userId: string) {
    return firstValueFrom(
      this.usersClient.send({ cmd: 'profile_get' }, { userId, role: UserRole.DOCTOR })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Get('patients')
  @Roles(UserRole.CLINIC_ADMIN, UserRole.SECRETARY, UserRole.DOCTOR)
  async getPatients(@Query('page') page = 1, @Query('limit') limit = 10) {
    return firstValueFrom(
      this.usersClient.send({ cmd: 'profile_get_patients' }, { page: +page, limit: +limit })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Get('patients/:userId')
  @Roles(UserRole.CLINIC_ADMIN, UserRole.SECRETARY, UserRole.DOCTOR)
  async getPatientById(@Param('userId') userId: string) {
    return firstValueFrom(
      this.usersClient.send({ cmd: 'profile_get' }, { userId, role: UserRole.PATIENT })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Get('doctor/dashboard')
  @Roles(UserRole.DOCTOR)
  @AllowedClients(ClientType.MOBILE_DOCTOR)
  async doctorDashboard(@CurrentUser() user: any) {
    return firstValueFrom(
      this.usersClient.send({ cmd: 'profile_get' }, { userId: user.sub, role: UserRole.DOCTOR })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Get('patient/dashboard')
  @Roles(UserRole.PATIENT)
  @AllowedClients(ClientType.MOBILE_PATIENT)
  async patientDashboard(@CurrentUser() user: any) {
    return firstValueFrom(
      this.usersClient.send({ cmd: 'profile_get' }, { userId: user.sub, role: UserRole.PATIENT })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Get('admin/dashboard')
  @Roles(UserRole.CLINIC_ADMIN)
  @AllowedClients(ClientType.WEB_ADMIN)
  async adminDashboard(@CurrentUser() user: any) {
    return firstValueFrom(
      this.usersClient.send({ cmd: 'profile_get' }, { userId: user.sub, role: UserRole.CLINIC_ADMIN })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
  }

  @Get('secretary/dashboard')
  @Roles(UserRole.SECRETARY)
  @AllowedClients(ClientType.WEB_SECRETARY)
  async secretaryDashboard(@CurrentUser() user: any) {
    return firstValueFrom(
      this.usersClient.send({ cmd: 'profile_get' }, { userId: user.sub, role: UserRole.SECRETARY })
        .pipe(catchError((err) => throwError(() => this.mapError(err)))),
    );
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

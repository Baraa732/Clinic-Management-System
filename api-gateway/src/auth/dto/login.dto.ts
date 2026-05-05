import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ClientType } from '../../common/enums/user.enum';

export class LoginDto {
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsEnum(ClientType, { message: 'Invalid client type' })
  clientType: ClientType;

  @IsOptional()
  @IsString()
  deviceInfo?: string;
}

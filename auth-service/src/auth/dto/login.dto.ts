import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ClientType } from '../../common/enums/user.enum';

export class LoginDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @MaxLength(100)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(64)
  password: string;

  @IsEnum(ClientType, { message: 'Invalid client type' })
  clientType: ClientType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  deviceInfo?: string;
}

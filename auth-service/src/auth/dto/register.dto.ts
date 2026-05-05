import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ClientType, UserRole } from '../../common/enums/user.enum';

export class RegisterDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @MaxLength(100)
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(64)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&^#()_+\-=\[\]{};':"\\|,.<>\/?])[A-Za-z\d@$!%*?&^#()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/,
    { message: 'Password must contain uppercase, lowercase, number and special character' },
  )
  password: string;

  @IsEnum(UserRole, { message: 'Invalid role' })
  role: UserRole;

  @IsEnum(ClientType, { message: 'Invalid client type' })
  clientType: ClientType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Invalid phone number' })
  phone?: string;
}

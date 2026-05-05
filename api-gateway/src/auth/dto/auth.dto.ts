import { IsEmail, IsNotEmpty, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&^#()_+\-=\[\]{};':"\\|,.<>\/?])[A-Za-z\d@$!%*?&^#()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/,
    { message: 'Password must contain uppercase, lowercase, number and special character' },
  )
  newPassword: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(100)
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsUUID()
  userId: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&^#()_+\-=\[\]{};':"\\|,.<>\/?])[A-Za-z\d@$!%*?&^#()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/,
    { message: 'Password must contain uppercase, lowercase, number and special character' },
  )
  newPassword: string;
}

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsUUID()
  userId: string;
}

export class AdminRevokeSessionsDto {
  @IsString()
  @IsNotEmpty()
  targetUserId: string;
}

export class ResendVerificationDto {
  @IsEmail()
  @MaxLength(100)
  email: string;
}

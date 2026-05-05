import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from './register.dto';
import { UserRole, ClientType } from '../../common/enums/user.enum';

const validBase = {
  email: 'test@example.com',
  role: UserRole.PATIENT,
  clientType: ClientType.MOBILE_PATIENT,
  firstName: 'John',
  lastName: 'Doe',
};

async function validatePassword(password: string) {
  const dto = plainToInstance(RegisterDto, { ...validBase, password });
  const errors = await validate(dto);
  return errors.find((e) => e.property === 'password');
}

describe('RegisterDto - password validation', () => {
  it('accepts a strong password', async () => {
    expect(await validatePassword('StrongP@ss1')).toBeUndefined();
  });

  it('rejects password shorter than 8 characters', async () => {
    expect(await validatePassword('Sh0rt!')).toBeDefined();
  });

  it('rejects password longer than 64 characters', async () => {
    expect(await validatePassword('A1@' + 'a'.repeat(62))).toBeDefined();
  });

  it('rejects password without uppercase letter', async () => {
    expect(await validatePassword('weakpass1@')).toBeDefined();
  });

  it('rejects password without lowercase letter', async () => {
    expect(await validatePassword('WEAKPASS1@')).toBeDefined();
  });

  it('rejects password without a number', async () => {
    expect(await validatePassword('WeakPass@!')).toBeDefined();
  });

  it('rejects password without a special character', async () => {
    expect(await validatePassword('WeakPass123')).toBeDefined();
  });

  it('rejects empty password', async () => {
    expect(await validatePassword('')).toBeDefined();
  });

  it('accepts password with 8 characters meeting all rules', async () => {
    expect(await validatePassword('Abcdef1@')).toBeUndefined();
  });

  it('accepts password with 64 characters meeting all rules', async () => {
    expect(await validatePassword('A1@' + 'a'.repeat(61))).toBeUndefined();
  });
});

import { SetMetadata } from '@nestjs/common';
import { ClientType } from '../enums/user.enum';

export const CLIENT_TYPES_KEY = 'clientTypes';
export const AllowedClients = (...types: ClientType[]) => SetMetadata(CLIENT_TYPES_KEY, types);

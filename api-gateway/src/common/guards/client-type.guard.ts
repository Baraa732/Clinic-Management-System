import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CLIENT_TYPES_KEY } from '../decorators/client-type.decorator';
import { ClientType } from '../enums/user.enum';

@Injectable()
export class ClientTypeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredClientTypes = this.reflector.getAllAndOverride<ClientType[]>(CLIENT_TYPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredClientTypes || requiredClientTypes.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Access denied');

    const hasClientType = requiredClientTypes.includes(user.clientType);
    if (!hasClientType) {
      throw new ForbiddenException(`This endpoint is not available for your application type`);
    }

    return true;
  }
}

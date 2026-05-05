import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Response, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

const STATUS_MAP: Record<string, number> = {
  UnauthorizedException: 401,
  ForbiddenException: 403,
  NotFoundException: 404,
  ConflictException: 409,
  BadRequestException: 400,
  Unauthorized: 401,
  Forbidden: 403,
  'Not Found': 404,
  Conflict: 409,
  'Bad Request': 400,
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = uuidv4();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = 'Internal server error';
    let error: string = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;
      message = Array.isArray(res.message)
        ? res.message.join(', ')
        : (res.message || exception.message);
      error = res.error || exception.name;
    } else if (exception instanceof RpcException) {
      const rpcError = exception.getError() as any;
      status = rpcError.statusCode || HttpStatus.BAD_REQUEST;
      message = rpcError.message || 'Microservice error';
      error = rpcError.error || 'RPC Error';
    } else if (exception?.statusCode && exception?.message) {
      status = exception.statusCode || STATUS_MAP[exception.error] || HttpStatus.INTERNAL_SERVER_ERROR;
      message = Array.isArray(exception.message)
        ? exception.message.join(', ')
        : exception.message;
      error = exception.error || 'Error';
    } else if (exception?.message) {
      for (const [key, code] of Object.entries(STATUS_MAP)) {
        if (exception.message.includes(key) || exception.name === key) {
          status = code;
          break;
        }
      }
      message = exception.message;
      error = exception.name || 'Error';
    }

    // Never expose internal errors to clients
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} - 500: ${exception?.message}`,
        exception?.stack,
      );
      message = 'An unexpected error occurred. Please try again later.';
      error = 'Internal Server Error';
    } else {
      this.logger.warn(`[${requestId}] ${request.method} ${request.url} - ${status}: ${message}`);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      error,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '@iconicedu/api/modules/auth/auth.service';
import { updateRequestContext } from '@iconicedu/api/observability/request-context';
import type { JwtPayload } from 'jsonwebtoken';

type SupabaseJwtPayload = JwtPayload & {
  user_metadata?: {
    app_role?: string;
  };
};

function isJwtPayload(value: string | JwtPayload | null): value is SupabaseJwtPayload {
  return Boolean(value) && typeof value === 'object';
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing token');
    }
    const token = authHeader.slice('Bearer '.length);
    const decoded = this.authService.decodeToken(token);
    if (!isJwtPayload(decoded) || typeof decoded.sub !== 'string') {
      throw new UnauthorizedException('Invalid token');
    }

    req.user = {
      id: decoded.sub,
      role: decoded.user_metadata?.app_role ?? 'guardian',
    };
    updateRequestContext({
      authUserId: decoded.sub,
      userRole: decoded.user_metadata?.app_role ?? 'guardian',
    });

    return true;
  }
}

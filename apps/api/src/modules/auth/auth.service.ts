import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';

// In production you should validate JWTs using Supabase JWKS or your own signing key.
@Injectable()
export class AuthService {
  decodeToken(token: string): string | JwtPayload | null {
    return jwt.decode(token);
  }
}

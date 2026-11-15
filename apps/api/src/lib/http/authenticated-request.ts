import { UnauthorizedException } from '@nestjs/common';

export type AuthenticatedRequest = {
  user: { id: string };
  headers: { authorization?: string };
};

export function extractBearerToken(authorization: string | undefined): string {
  const header = authorization?.trim() ?? '';
  if (!header.toLowerCase().startsWith('bearer ')) {
    throw new UnauthorizedException('Missing token');
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw new UnauthorizedException('Missing token');
  }

  return token;
}

/** Like extractBearerToken, but for endpoints where being signed in is optional. */
export function extractOptionalBearerToken(
  authorization: string | undefined,
): string | null {
  const header = authorization?.trim() ?? '';
  if (!header.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

import { Body, Controller, Get, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { NotificationPreferencesService } from '@iconicedu/api/modules/notification-preferences/notification-preferences.service';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';

@Controller('notification-preferences')
export class NotificationPreferencesController {
  constructor(
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}

  @Get()
  @UseGuards(AuthGuard)
  list(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('profileId') profileId: string,
    @Query('prefKey') prefKey?: string,
    @Query('scopeId') scopeId?: string,
  ) {
    return this.notificationPreferencesService.list(
      extractBearerToken(req.headers.authorization),
      { orgId, profileId, prefKey, scopeId },
    );
  }

  @Put()
  @UseGuards(AuthGuard)
  upsert(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      orgId: string;
      profileId: string;
      prefKey: string;
      channels: string[];
      muted?: boolean;
      scopeKind?: string | null;
      scopeId?: string | null;
    },
  ) {
    return this.notificationPreferencesService.upsert(
      extractBearerToken(req.headers.authorization),
      body,
    );
  }
}

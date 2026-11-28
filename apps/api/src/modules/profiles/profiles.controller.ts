import type {
  ProfileSettingsInput,
  ProfileSettingsSectionInput,
} from '@iconicedu/shared-types';
import { ProfileSettingsService } from './profile-settings.service';
import { TimezoneLocationService } from './timezone-location.service';
import { UpdateProfileLocationDto } from './dto/update-profile-location.dto';
import {
  Body,
  Delete,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import { ProfilesService } from '@iconicedu/api/modules/profiles/profiles.service';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';

@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly profileSettingsService: ProfileSettingsService,
    private readonly profilesService: ProfilesService,
    private readonly timezoneLocationService: TimezoneLocationService,
  ) {}

  @Get('location-hint')
  @UseGuards(AuthGuard)
  locationHint(@Query('timezone') timezone: string | undefined) {
    return this.timezoneLocationService.lookup(
      typeof timezone === 'string' ? timezone : '',
    );
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: AuthenticatedRequest) {
    return this.profilesService.me(extractBearerToken(req.headers.authorization));
  }

  @Get('by-account')
  @UseGuards(AuthGuard)
  byAccount(@Req() req: AuthenticatedRequest, @Query('accountId') accountId: string) {
    return this.profilesService.byAccount(
      extractBearerToken(req.headers.authorization),
      accountId,
    );
  }

  @Get('active-for-account')
  @UseGuards(AuthGuard)
  activeForAccount(
    @Req() req: AuthenticatedRequest,
    @Query('accountId') accountId: string,
  ) {
    return this.profilesService.activeForAccount(
      extractBearerToken(req.headers.authorization),
      accountId,
    );
  }

  @Post('children')
  @UseGuards(AuthGuard)
  createChildProfile(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      orgId: string;
      displayName: string;
      firstName: string;
      lastName: string;
      gradeLevel: string;
      birthYear: number;
      email?: string | null;
      timezone?: string | null;
      city?: string | null;
      region?: string | null;
      countryCode?: string | null;
      countryName?: string | null;
      postalCode?: string | null;
      themeKey?: string | null;
      locale?: string | null;
    },
  ) {
    return this.profilesService.createChildProfile(
      extractBearerToken(req.headers.authorization),
      body,
    );
  }

  @Get('by-account-ids')
  @UseGuards(AuthGuard)
  byAccountIds(
    @Req() req: AuthenticatedRequest,
    @Query('orgId') orgId: string,
    @Query('accountIds') accountIds: string,
  ) {
    const idList = (accountIds ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    return this.profilesService.byAccountIds(
      extractBearerToken(req.headers.authorization),
      orgId,
      idList,
    );
  }

  @Get()
  @UseGuards(AuthGuard)
  list(@Req() req: AuthenticatedRequest, @Query('ids') ids: string) {
    return this.profilesService.list(
      extractBearerToken(req.headers.authorization),
      ids
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    );
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  get(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.profilesService.get(extractBearerToken(req.headers.authorization), id);
  }

  @Get(':id/settings')
  @UseGuards(AuthGuard)
  settings(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.profileSettingsService.get(
      extractBearerToken(req.headers.authorization),
      id,
    );
  }

  @Put(':id/settings')
  @UseGuards(AuthGuard)
  saveSettings(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ProfileSettingsInput | ProfileSettingsSectionInput,
  ) {
    return this.profileSettingsService.save(
      extractBearerToken(req.headers.authorization),
      id,
      body,
    );
  }

  @Delete(':id/family-child')
  @UseGuards(AuthGuard)
  removeChild(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.profileSettingsService.remove(
      extractBearerToken(req.headers.authorization),
      id,
    );
  }

  @Put(':id/location')
  @UseGuards(AuthGuard)
  updateLocation(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateProfileLocationDto,
  ) {
    return this.profilesService.updateLocation(
      extractBearerToken(req.headers.authorization),
      id,
      body,
    );
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body()
    body: {
      displayName?: string;
      firstName?: string;
      lastName?: string;
      timezone?: string;
      location?: string;
      avatarUrl?: string;
    },
  ) {
    return this.profilesService.update(
      extractBearerToken(req.headers.authorization),
      id,
      body,
    );
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';
import { ClassroomMeetingSettingsService } from './classroom-meeting-settings.service';

@Controller('classroom-meeting-settings')
@UseGuards(AuthGuard)
export class ClassroomMeetingSettingsController {
  constructor(private readonly settings: ClassroomMeetingSettingsService) {}
  @Get()
  get(
    @Req() req: AuthenticatedRequest,
    @Query('orgSlug') orgSlug: string,
    @Query('classroomId') classroomId?: string,
  ) {
    if (!orgSlug?.trim()) throw new BadRequestException('orgSlug is required');
    return this.settings.get(
      extractBearerToken(req.headers.authorization),
      orgSlug,
      classroomId,
    );
  }
  @Put()
  save(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException('Invalid meeting settings request');
    const input = body as Record<string, unknown>;
    for (const key of ['orgId', 'profileId', 'classroomId']) {
      if (typeof input[key] !== 'string' || !(input[key] as string).trim())
        throw new BadRequestException(`${key} is required`);
    }
    return this.settings.save(extractBearerToken(req.headers.authorization), {
      orgId: input.orgId as string,
      profileId: input.profileId as string,
      classroomId: input.classroomId as string,
      settings: input.settings,
    });
  }
}

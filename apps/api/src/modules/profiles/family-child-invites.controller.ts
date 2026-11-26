import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { CreateFamilyChildInviteInput } from '@iconicedu/shared-types';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';
import { FamilyChildInvitesService } from './family-child-invites.service';
@Controller('family-child-invites')
@UseGuards(AuthGuard)
export class FamilyChildInvitesController {
  constructor(private readonly invites: FamilyChildInvitesService) {}
  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.invites.list(extractBearerToken(req.headers.authorization));
  }
  @Post()
  send(@Req() req: AuthenticatedRequest, @Body() body: CreateFamilyChildInviteInput) {
    return this.invites.send(extractBearerToken(req.headers.authorization), body);
  }
  @Delete(':id')
  revoke(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.invites.revoke(extractBearerToken(req.headers.authorization), id);
  }
}

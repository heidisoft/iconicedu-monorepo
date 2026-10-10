import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import {
  extractBearerToken,
  type AuthenticatedRequest,
} from '@iconicedu/api/lib/http/authenticated-request';
import { ScreenAnnotationsService } from './screen-annotations.service';
import {
  annotationUuid,
  parseAnnotationOperation,
  parseAnnotationPointer,
} from './screen-annotation.dto';
@Controller('screen-annotations')
@UseGuards(AuthGuard)
export class ScreenAnnotationsController {
  constructor(private readonly annotations: ScreenAnnotationsService) {}
  @Get(':sessionId')
  context(
    @Req() req: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Query('shareKey') shareKey: string,
  ) {
    if (!/^[0-9]{1,16}$/.test(shareKey ?? ''))
      throw new BadRequestException('Invalid share key');
    return this.annotations.context(
      extractBearerToken(req.headers.authorization),
      annotationUuid(sessionId),
      shareKey,
    );
  }
  @Post(':sessionId/pointer')
  @HttpCode(204)
  pointer(
    @Req() req: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Query('shareKey') shareKey: string,
    @Body() body: unknown,
  ) {
    if (!/^[0-9]{1,16}$/.test(shareKey ?? ''))
      throw new BadRequestException('Invalid share key');
    return this.annotations.pointer(
      extractBearerToken(req.headers.authorization),
      annotationUuid(sessionId),
      shareKey,
      parseAnnotationPointer(body),
    );
  }
  @Post(':roomId/operations')
  apply(
    @Req() req: AuthenticatedRequest,
    @Param('roomId') roomId: string,
    @Body() body: unknown,
  ) {
    return this.annotations.apply(
      extractBearerToken(req.headers.authorization),
      annotationUuid(roomId),
      parseAnnotationOperation(body),
    );
  }
}

/** Public transport with opaque meeting capabilities verified on every service call. */
@Controller('screen-annotations/guest')
export class GuestScreenAnnotationsController {
  constructor(private readonly annotations: ScreenAnnotationsService) {}
  @Get(':sessionId')
  context(
    @Req() req: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Query('shareKey') shareKey: string,
  ) {
    if (!/^[0-9]{1,16}$/.test(shareKey ?? ''))
      throw new BadRequestException('Invalid share key');
    return this.annotations.guestContext(
      extractBearerToken(req.headers.authorization),
      annotationUuid(sessionId),
      shareKey,
    );
  }
  @Post(':sessionId/pointer')
  @HttpCode(204)
  pointer(
    @Req() req: AuthenticatedRequest,
    @Param('sessionId') sessionId: string,
    @Query('shareKey') shareKey: string,
    @Body() body: unknown,
  ) {
    if (!/^[0-9]{1,16}$/.test(shareKey ?? ''))
      throw new BadRequestException('Invalid share key');
    return this.annotations.pointer(
      extractBearerToken(req.headers.authorization),
      annotationUuid(sessionId),
      shareKey,
      parseAnnotationPointer(body),
      true,
    );
  }
  @Post(':roomId/operations')
  apply(
    @Req() req: AuthenticatedRequest,
    @Param('roomId') roomId: string,
    @Body() body: unknown,
  ) {
    return this.annotations.guestApply(
      extractBearerToken(req.headers.authorization),
      annotationUuid(roomId),
      parseAnnotationOperation(body),
    );
  }
}

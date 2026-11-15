import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@iconicedu/api/modules/auth/auth.guard';
import type { AuthenticatedRequest } from '@iconicedu/api/lib/http/authenticated-request';
import {
  LearningSpaceLifecycleService,
  parseLearningSpaceLifecycleInput,
} from '@iconicedu/api/modules/spaces/learning-space-lifecycle.service';

@Controller('admin/learning-spaces')
export class AdminLearningSpacesController {
  constructor(private readonly lifecycle: LearningSpaceLifecycleService) {}

  @Post(':learningSpaceId/archive')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  archive(
    @Req() req: AuthenticatedRequest,
    @Param('learningSpaceId') learningSpaceId: string,
    @Body() body: unknown,
  ) {
    return this.lifecycle.run(
      'archive',
      req.user.id,
      parseLearningSpaceLifecycleInput(learningSpaceId, body),
    );
  }

  @Post(':learningSpaceId/restore')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  restore(
    @Req() req: AuthenticatedRequest,
    @Param('learningSpaceId') learningSpaceId: string,
    @Body() body: unknown,
  ) {
    return this.lifecycle.run(
      'restore',
      req.user.id,
      parseLearningSpaceLifecycleInput(learningSpaceId, body),
    );
  }

  @Delete(':learningSpaceId')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('learningSpaceId') learningSpaceId: string,
    @Body() body: unknown,
  ) {
    return this.lifecycle.run(
      'delete',
      req.user.id,
      parseLearningSpaceLifecycleInput(learningSpaceId, body),
    );
  }
}

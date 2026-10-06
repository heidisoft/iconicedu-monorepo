import { Body, Controller, Get, Post, Req, Query } from '@nestjs/common';
type Request = { headers: { authorization?: string } };
import { WhiteboardsService } from './whiteboards.service';

/** Public transport; opaque per-board capabilities are verified on EVERY read/write in service. */
@Controller('whiteboards')
export class WhiteboardsController {
  constructor(private readonly boards: WhiteboardsService) {}
  @Get('current')
  get(@Req() req: Request, @Query('revision') revision?: string) {
    return revision && /^\d+$/.test(revision)
      ? this.boards.get(this.token(req), Number(revision))
      : this.boards.get(this.token(req));
  }
  @Post('current/operations')
  mutate(@Req() req: Request, @Body() body: unknown) {
    return this.boards.mutate(this.token(req), body);
  }
  private token(req: Request) {
    return req.headers.authorization?.replace(/^Bearer /, '') ?? '';
  }
}

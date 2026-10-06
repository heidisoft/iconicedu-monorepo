import { Module } from '@nestjs/common';
import { WhiteboardsController } from './whiteboards.controller';
import { WhiteboardsService } from './whiteboards.service';
@Module({ providers: [WhiteboardsService], controllers: [WhiteboardsController] })
export class WhiteboardsModule {}

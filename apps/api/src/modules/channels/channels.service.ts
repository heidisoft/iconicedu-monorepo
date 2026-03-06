import { Injectable } from '@nestjs/common';
import { PrismaService } from '@iconicedu/api/prisma/prisma.service';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  listChannelsForUser(_userId: string) {
    return this.prisma.channel.findMany({
      where: {
        // relies on RLS in Supabase if used directly there; here it's simple prisma query
      },
    });
  }
}

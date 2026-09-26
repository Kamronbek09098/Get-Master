import { Controller, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { MatchingQueryDto } from './dto/matching-query.dto';
import { ERRORS } from '../../common/constants/error-messages';

@Controller('problem-requests')
@Roles(Role.CUSTOMER)
export class MatchingController {
  constructor(private readonly db: PrismaService) {}

  @Get(':id/matching')
  async getLatestRun(
    @CurrentUser('sub') customerId: string,
    @Param('id', ParseUUIDPipe) requestId: string,
    @Query() query: MatchingQueryDto,
  ) {
    const request = await this.db.problemRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException(ERRORS.REQUEST_NOT_FOUND);
    if (request.customerId !== customerId) throw new ForbiddenException(ERRORS.NOT_REQUEST_OWNER);

    const run = await this.db.matchingRun.findFirst({ where: { requestId }, orderBy: { createdAt: 'desc' } });
    if (!run) return { run: null, results: [] };

    const results = await this.db.matchingResult.findMany({
      where: { runId: run.id },
      orderBy: { score: 'desc' },
      take: query.limit,
      include: { master: { select: { user: { select: { accountNumber: true } } } } },
    });
    return { run, results };
  }
}

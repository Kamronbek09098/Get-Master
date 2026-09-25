import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditQueryDto } from './dto/audit-query.dto';
import { AuditService } from './audit.service';

@Controller('audit-logs')
@Roles(Role.ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(@Query() query: AuditQueryDto) {
    return this.auditService.findAll(query);
  }
}

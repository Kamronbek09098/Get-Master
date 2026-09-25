import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ClassificationService } from './classification.service';
import { CreateClassificationDto } from './dto/create-classification.dto';
import { UpdateClassificationDto } from './dto/update-classification.dto';

@Controller('problem-requests')
@Roles(Role.CUSTOMER)
export class ClassificationController {
  constructor(private readonly classification: ClassificationService) {}

  @Get(':id/classification')
  getLatest(@CurrentUser('sub') customerId: string, @Param('id', ParseUUIDPipe) requestId: string) {
    return this.classification.getLatest(customerId, requestId);
  }

  @Post(':id/classification')
  setManual(
    @CurrentUser('sub') customerId: string,
    @Param('id', ParseUUIDPipe) requestId: string,
    @Body() dto: CreateClassificationDto,
  ) {
    return this.classification.setManual(customerId, requestId, dto.serviceId);
  }

  @Patch(':id/classification')
  correct(
    @CurrentUser('sub') customerId: string,
    @Param('id', ParseUUIDPipe) requestId: string,
    @Body() dto: UpdateClassificationDto,
  ) {
    return this.classification.setManual(customerId, requestId, dto.serviceId);
  }
}

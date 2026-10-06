import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Delete,
} from '@nestjs/common';
import { CurrentUser } from '../common/auth.decorator.js';
import type { AuthenticatedUser } from '../common/auth.types.js';
import { Roles } from '../common/roles.decorator.js';
import { CampaignsService } from './campaigns.service.js';
import { CreateCampaignDto } from './dto/create-campaign.dto.js';
import { UpdateCampaignDto } from './dto/update-campaign.dto.js';

@Controller('campaigns')
export class CampaignsController {
  constructor(
    @Inject(CampaignsService) private readonly campaigns: CampaignsService,
  ) {}
  @Get() list() {
    return this.campaigns.list();
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.campaigns.findOne(id);
  }
  @Post() @Roles('ADMIN', 'MARKETING_OFFICER') create(
    @Body() dto: CreateCampaignDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaigns.create(dto, user.id);
  }
  @Patch(':id') @Roles('ADMIN', 'MARKETING_OFFICER') update(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaigns.update(id, dto, user.id);
  }
  @Delete(':id') @Roles('ADMIN') archive(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaigns.archive(id, user.id);
  }
}

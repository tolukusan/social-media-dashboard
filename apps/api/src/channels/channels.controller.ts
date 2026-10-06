import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ChannelsService } from './channels.service.js';
import { CreateChannelDto } from './dto/create-channel.dto.js';
import { CreatePlatformDto } from './dto/create-platform.dto.js';
import { Roles } from '../common/roles.decorator.js';
import { UpdateCatalogueDto } from './dto/update-catalogue.dto.js';

@Controller()
export class ChannelsController {
  constructor(
    @Inject(ChannelsService) private readonly channels: ChannelsService,
  ) {}
  @Get('channels') listChannels() {
    return this.channels.listChannels();
  }
  @Get('channels/:id/metrics') listChannelMetrics(@Param('id') id: string) {
    return this.channels.listChannelMetrics(id);
  }
  @Post('channels') @Roles('ADMIN') createChannel(
    @Body() dto: CreateChannelDto,
  ) {
    return this.channels.createChannel(dto);
  }
  @Delete('channels/:id') @Roles('ADMIN') deactivateChannel(
    @Param('id') id: string,
  ) {
    return this.channels.deactivateChannel(id);
  }
  @Patch('channels/:id') @Roles('ADMIN') updateChannel(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogueDto,
  ) {
    return this.channels.updateChannel(id, dto);
  }
  @Get('platforms') listPlatforms(@Query('channelId') channelId?: string) {
    return this.channels.listPlatforms(channelId);
  }
  @Post('platforms') @Roles('ADMIN') createPlatform(
    @Body() dto: CreatePlatformDto,
  ) {
    return this.channels.createPlatform(dto);
  }
  @Delete('platforms/:id') @Roles('ADMIN') deactivatePlatform(
    @Param('id') id: string,
  ) {
    return this.channels.deactivatePlatform(id);
  }
  @Patch('platforms/:id') @Roles('ADMIN') updatePlatform(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogueDto,
  ) {
    return this.channels.updatePlatform(id, dto);
  }
}

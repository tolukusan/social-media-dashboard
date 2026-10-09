import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller.js';
import { IntegrationsService } from './integrations.service.js';
import { ProviderClient } from './provider-client.js';

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService, ProviderClient],
})
export class IntegrationsModule {}

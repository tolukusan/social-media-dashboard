import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller.js';
import { IntegrationsService } from './integrations.service.js';
import { ProviderClient } from './provider-client.js';
import { OAuthCredentialService } from './oauth-credential.service.js';

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService, ProviderClient, OAuthCredentialService],
})
export class IntegrationsModule {}

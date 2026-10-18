import { Module } from '@nestjs/common';
import {
  AccessController,
  PublicAccessController,
} from './access.controller.js';
import { AccessService } from './access.service.js';
@Module({
  controllers: [AccessController, PublicAccessController],
  providers: [AccessService],
})
export class AccessModule {}

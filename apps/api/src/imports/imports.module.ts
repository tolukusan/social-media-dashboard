import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller.js';
import { ImportsService } from './imports.service.js';
import { FileParserService } from './file-parser.service.js';

@Module({
  controllers: [ImportsController],
  providers: [ImportsService, FileParserService],
})
export class ImportsModule {}

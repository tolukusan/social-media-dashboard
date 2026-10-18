import { Module } from '@nestjs/common';
import { DatasetsController } from './datasets.controller.js';
import { DatasetFileParser } from './dataset-file-parser.js';
import { DatasetsService } from './datasets.service.js';

@Module({
  controllers: [DatasetsController],
  providers: [DatasetsService, DatasetFileParser],
  exports: [DatasetsService],
})
export class DatasetsModule {}

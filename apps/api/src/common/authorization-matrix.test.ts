import 'reflect-metadata';
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { AuthController } from '../auth/auth.controller.js';
import { UsersController } from '../users/users.controller.js';
import { ChannelsController } from '../channels/channels.controller.js';
import { CampaignsController } from '../campaigns/campaigns.controller.js';
import { PerformanceController } from '../performance/performance.controller.js';
import { TargetsController } from '../targets/targets.controller.js';
import { ImportsController } from '../imports/imports.controller.js';

function effectiveRoles(controller: object, method: string) {
  const type = controller as {
    prototype: Record<string, unknown>;
  };
  const handler = type.prototype[method];
  return ((handler && Reflect.getMetadata('roles', handler as object)) ??
    Reflect.getMetadata('roles', controller) ??
    []) as string[];
}

describe('route authorization metadata matrix', () => {
  it('matches the approved write-role matrix', () => {
    const cases: Array<[object, string, string[]]> = [
      [AuthController, 'changeOwnPassword', []],
      [AuthController, 'updateMe', []],
      [UsersController, 'create', ['ADMIN']],
      [UsersController, 'update', ['ADMIN']],
      [UsersController, 'deactivate', ['ADMIN']],
      [UsersController, 'resetPassword', ['ADMIN']],
      [UsersController, 'reactivate', ['ADMIN']],
      [ChannelsController, 'createChannel', ['ADMIN']],
      [ChannelsController, 'updateChannel', ['ADMIN']],
      [ChannelsController, 'deactivateChannel', ['ADMIN']],
      [ChannelsController, 'createPlatform', ['ADMIN']],
      [ChannelsController, 'updatePlatform', ['ADMIN']],
      [ChannelsController, 'deactivatePlatform', ['ADMIN']],
      [CampaignsController, 'create', ['ADMIN', 'MARKETING_OFFICER']],
      [CampaignsController, 'update', ['ADMIN', 'MARKETING_OFFICER']],
      [CampaignsController, 'archive', ['ADMIN']],
      [PerformanceController, 'create', ['ADMIN', 'MARKETING_OFFICER']],
      [PerformanceController, 'update', ['ADMIN', 'MARKETING_OFFICER']],
      [PerformanceController, 'archive', ['ADMIN']],
      [TargetsController, 'create', ['ADMIN']],
      [TargetsController, 'update', ['ADMIN']],
      [ImportsController, 'preview', ['ADMIN', 'MARKETING_OFFICER']],
      [ImportsController, 'map', ['ADMIN', 'MARKETING_OFFICER']],
      [ImportsController, 'confirm', ['ADMIN', 'MARKETING_OFFICER']],
    ];
    for (const [controller, method, expected] of cases)
      assert.deepEqual(
        effectiveRoles(controller, method),
        expected,
        `${(controller as { name?: string }).name ?? 'Controller'}.${method}`,
      );
  });
});

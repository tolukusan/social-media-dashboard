import { describe, expect, it } from 'vitest';
import { resolveApiPort } from './server-config.js';

describe('resolveApiPort', () => {
  it('prefers Render PORT over the local API_PORT setting', () => {
    expect(resolveApiPort({ PORT: '10000', API_PORT: '4000' })).toBe(10000);
  });

  it('keeps API_PORT and 4000 as local fallbacks', () => {
    expect(resolveApiPort({ API_PORT: '4100' })).toBe(4100);
    expect(resolveApiPort({})).toBe(4000);
  });

  it.each(['0', '65536', 'not-a-port', ''])(
    'rejects invalid port %j',
    (value) => {
      expect(() => resolveApiPort({ PORT: value })).toThrow(/PORT/);
    },
  );
});

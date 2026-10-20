import { describe, expect, it } from 'vitest';
import { resolveProductionApiOrigin } from '../../web/lib/deployment-config.cjs';

describe('resolveProductionApiOrigin', () => {
  it('requires a backend origin in production', () => {
    expect(() => resolveProductionApiOrigin('production', undefined)).toThrow(
      /SMD_API_ORIGIN/,
    );
  });

  it('accepts an HTTPS origin and rejects paths or insecure public URLs', () => {
    expect(
      resolveProductionApiOrigin('production', 'https://smmd-api.onrender.com'),
    ).toBe('https://smmd-api.onrender.com');
    expect(() =>
      resolveProductionApiOrigin(
        'production',
        'https://smmd-api.onrender.com/api/v1',
      ),
    ).toThrow(/origin/);
    expect(() =>
      resolveProductionApiOrigin('production', 'http://smmd-api.onrender.com'),
    ).toThrow(/HTTPS/);
  });

  it('allows loopback HTTP for the isolated local production-build proxy test', () => {
    expect(
      resolveProductionApiOrigin('production', 'http://localhost:4201'),
    ).toBe('http://localhost:4201');
  });

  it('leaves development routing under the existing NEXT_PUBLIC_API_URL setting', () => {
    expect(resolveProductionApiOrigin('development', undefined)).toBeNull();
  });
});

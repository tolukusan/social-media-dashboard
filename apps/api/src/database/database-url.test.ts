import { describe, expect, it } from 'vitest';
import { applicationDatabaseUrl } from './database-url.js';

describe('application database URL', () => {
  it('selects the application schema when Render supplies a bare URL', () => {
    const result = new URL(
      applicationDatabaseUrl(
        'postgresql://user:password@localhost/test?sslmode=require',
      ),
    );
    expect(result.searchParams.get('schema')).toBe('social_media_dashboard');
    expect(result.searchParams.get('sslmode')).toBe('require');
  });
  it('preserves an explicitly correct schema', () => {
    const url =
      'postgresql://user:password@localhost/test?schema=social_media_dashboard';
    expect(applicationDatabaseUrl(url)).toBe(url);
  });
  it('rejects conflicting schemas without disclosing credentials', () => {
    expect(() =>
      applicationDatabaseUrl(
        'postgresql://user:secret@localhost/test?schema=public',
      ),
    ).toThrow('DATABASE_URL must use the social_media_dashboard schema.');
  });
});

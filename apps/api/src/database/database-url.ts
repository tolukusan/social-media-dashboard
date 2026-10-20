export function applicationDatabaseUrl(value: string): string {
  const url = new URL(value);
  const schemas = url.searchParams.getAll('schema');
  if (schemas.some((schema) => schema !== 'social_media_dashboard')) {
    throw new Error('DATABASE_URL must use the social_media_dashboard schema.');
  }
  url.searchParams.set('schema', 'social_media_dashboard');
  return url.toString();
}

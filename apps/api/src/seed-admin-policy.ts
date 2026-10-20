export type AdminSeedAction = 'create' | 'upsert' | 'skip';

export function getAdminSeedAction(input: {
  production: boolean;
  administratorExists: boolean;
  credentialsConfigured: boolean;
}): AdminSeedAction {
  if (!input.credentialsConfigured) return 'skip';
  if (!input.production) return 'upsert';
  return input.administratorExists ? 'skip' : 'create';
}

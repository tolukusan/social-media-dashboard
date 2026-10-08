'use client';

import { useQuery } from '@tanstack/react-query';
import { ApiError, apiRequest, queryKeys } from '../../lib/api-client';
import type { CurrentUser } from '../../lib/workspace-types';

export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      try {
        return await apiRequest<CurrentUser>('/auth/me', { signal });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
  });
}

import type { QueryClient } from '@tanstack/react-query';
import { apiBase } from './api-config';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

let csrfTokenPromise: Promise<string> | undefined;

function csrfToken(): Promise<string> {
  csrfTokenPromise ??= fetch(`${apiBase}/auth/csrf`, {
    credentials: 'include',
  })
    .then(async (response) => {
      if (!response.ok)
        throw new ApiError(
          'Could not obtain a security token.',
          response.status,
        );
      const result = (await response.json()) as { csrfToken?: string };
      if (!result.csrfToken)
        throw new ApiError(
          'Could not obtain a security token.',
          response.status,
        );
      return result.csrfToken;
    })
    .catch((error: unknown) => {
      csrfTokenPromise = undefined;
      throw error;
    });
  return csrfTokenPromise;
}

export async function apiResponse(
  path: string,
  options: ApiRequestOptions = {},
): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    if (options.body instanceof FormData) body = options.body;
    else {
      headers.set('content-type', 'application/json');
      body = JSON.stringify(options.body);
    }
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('x-csrf-token', await csrfToken());
  }
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    method,
    headers,
    body,
    credentials: 'include',
  });
  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? '';
    const payload: unknown = contentType.includes('application/json')
      ? await response.json()
      : await response.text();
    const data =
      payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>)
        : {};
    if (data.code === 'CSRF_TOKEN_INVALID') csrfTokenPromise = undefined;
    const message =
      typeof data.message === 'string'
        ? data.message
        : response.status === 401
          ? 'Your session has expired. Please sign in again.'
          : response.status === 403
            ? 'You do not have permission to perform this action.'
            : 'The request could not be completed.';
    throw new ApiError(
      message,
      response.status,
      typeof data.code === 'string' ? data.code : undefined,
    );
  }
  return response;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await apiResponse(path, options);
  const contentType = response.headers.get('content-type') ?? '';
  const payload: unknown = contentType.includes('application/json')
    ? await response.json()
    : await response.text();
  return payload as T;
}

export async function apiBlob(path: string): Promise<Blob> {
  return (await apiResponse(path)).blob();
}

export const queryKeys = {
  session: ['session'] as const,
  workspace: (
    userId: string,
    filters: {
      from: string;
      to: string;
      campaignId: string;
      channelId: string;
      platformId: string;
      metricCode: string;
      targetPeriod: string;
    },
  ) => ['workspace', userId, filters] as const,
  users: ['users'] as const,
  userRoles: ['users', 'roles'] as const,
  targets: ['targets'] as const,
  targetDefinitions: ['targets', 'definitions'] as const,
  report: (filters: {
    from: string;
    to: string;
    campaignId: string;
    channelId: string;
    platformId: string;
    metricCode: string;
  }) => ['report-preview', filters] as const,
  imports: ['imports'] as const,
};

export async function invalidateWorkspace(queryClient: QueryClient) {
  await queryClient.cancelQueries({ queryKey: ['workspace'] });
  await queryClient.cancelQueries({ queryKey: ['workspace-context'] });
  // Expire shared metadata before active workspace queries request it again.
  await queryClient.invalidateQueries({ queryKey: ['workspace-context'] });
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['workspace'] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.imports }),
    queryClient.invalidateQueries({ queryKey: ['report-preview'] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.users }),
  ]);
}

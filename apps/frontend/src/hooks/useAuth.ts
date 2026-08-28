import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthUser } from '@repo/shared';
import { ApiError } from '@/api/client';
import { getCurrentUser, logout } from '@/api/endpoints';

export const AUTH_QUERY_KEY = ['auth', 'me'] as const;

export function useAuth() {
  const query = useQuery<AuthUser, ApiError>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: getCurrentUser,
    // A 401 is the normal "not logged in" answer, not a transient failure, so
    // retrying it would just delay showing the login page.
    retry: (failureCount, error) => error.status !== 401 && failureCount < 2,
    staleTime: 5 * 60 * 1000,
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isAuthenticated: Boolean(query.data),
    error: query.error,
  };
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Clear everything: another user's data must not survive a logout.
      queryClient.clear();
    },
  });
}

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateCampaignRequest, EmailStatus, Paginated, EmailRecord } from '@repo/shared';
import type { ApiError } from '@/api/client';
import {
  createCampaign,
  getCampaigns,
  getEmails,
  getSenders,
  searchEmails,
  type EmailSearchResponse,
} from '@/api/endpoints';

export const emailKeys = {
  all: ['emails'] as const,
  list: (status: EmailStatus, page: number) => ['emails', 'list', status, page] as const,
  search: (status: EmailStatus, query: string, page: number) =>
    ['emails', 'search', status, query, page] as const,
};

export interface UseEmailListOptions {
  status: EmailStatus;
  page: number;
  search: string;
  /** Poll only while there is work in flight; a settled list does not need it. */
  pollMs?: number;
}

export function useEmailList({ status, page, search, pollMs }: UseEmailListOptions) {
  const trimmed = search.trim();

  return useQuery<Paginated<EmailRecord> | EmailSearchResponse, ApiError>({
    queryKey: trimmed
      ? emailKeys.search(status, trimmed, page)
      : emailKeys.list(status, page),
    queryFn: () =>
      trimmed
        ? searchEmails({ status, page, q: trimmed })
        : getEmails({ status, page }),
    // Keeps the previous page visible while the next one loads, so paging and
    // typing in the search box do not flash an empty table.
    placeholderData: keepPreviousData,
    refetchInterval: pollMs,
    // These lists change from outside the browser - the worker delivers mail
    // on its own schedule - so a cached result is never trustworthy. Without
    // this, the global staleTime suppresses the refetch on a tab switch and
    // the Sent tab renders its pre-delivery empty state until the next poll.
    staleTime: 0,
  });
}

export function useSenders() {
  return useQuery({
    queryKey: ['senders'],
    queryFn: getSenders,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: getCampaigns,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCampaignRequest) => createCampaign(payload),
    onSuccess: () => {
      // New emails land as SCHEDULED, so both tables and the counts are stale.
      void queryClient.invalidateQueries({ queryKey: emailKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

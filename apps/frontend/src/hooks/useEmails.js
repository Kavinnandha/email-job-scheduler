import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cancelEmail, createCampaign, getCampaigns, getEmail, getEmails, getSenders, searchEmails, setEmailStarred, } from '@/api/endpoints';
export const emailKeys = {
    all: ['emails'],
    list: (status, page) => ['emails', 'list', status, page],
    search: (status, query, page) => ['emails', 'search', status, query, page],
};
export function useEmailList({ status, page, search, pollMs }) {
    const trimmed = search.trim();
    return useQuery({
        queryKey: trimmed
            ? emailKeys.search(status, trimmed, page)
            : emailKeys.list(status, page),
        queryFn: () => trimmed
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
        mutationFn: (payload) => createCampaign(payload),
        onSuccess: () => {
            // New emails land as SCHEDULED, so both tables and the counts are stale.
            void queryClient.invalidateQueries({ queryKey: emailKeys.all });
            void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
        },
    });
}
export function useEmail(id) {
    return useQuery({
        queryKey: ['email', id],
        queryFn: () => getEmail(id),
        enabled: Boolean(id),
    });
}
/**
 * Star toggling is optimistic: the icon must respond on the click, not after a
 * round trip. Every cached list page is patched, and the previous cache is
 * restored if the request fails so the UI cannot drift from the server.
 */
export function useToggleStar() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, starred }) => setEmailStarred(id, starred),
        onMutate: async ({ id, starred }) => {
            await queryClient.cancelQueries({ queryKey: emailKeys.all });
            const snapshot = queryClient.getQueriesData({
                queryKey: emailKeys.all,
            });
            for (const [key, data] of snapshot) {
                if (!data?.items)
                    continue;
                queryClient.setQueryData(key, {
                    ...data,
                    items: data.items.map((item) => (item.id === id ? { ...item, starred } : item)),
                });
            }
            return { snapshot };
        },
        onError: (_err, _vars, context) => {
            for (const [key, data] of context?.snapshot ?? []) {
                queryClient.setQueryData(key, data);
            }
        },
        onSettled: (_data, _err, variables) => {
            void queryClient.invalidateQueries({ queryKey: ['email', variables.id] });
        },
    });
}
export function useCancelEmail() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id) => cancelEmail(id),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: emailKeys.all });
        },
    });
}

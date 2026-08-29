import { apiRequest } from './client';
// --- Auth -------------------------------------------------------------------
export const getCurrentUser = () => apiRequest('/api/auth/me');
export const logout = () => apiRequest('/api/auth/logout', { method: 'POST' });
// --- Senders ----------------------------------------------------------------
export const getSenders = () => apiRequest('/api/senders');
// --- Campaigns --------------------------------------------------------------
export const getCampaigns = () => apiRequest('/api/campaigns');
export const createCampaign = (payload) => apiRequest('/api/campaigns', { method: 'POST', body: payload });
function toQueryString(params) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '')
            search.set(key, String(value));
    }
    const query = search.toString();
    return query ? `?${query}` : '';
}
export const getEmails = (params = {}) => apiRequest(`/api/emails${toQueryString({ ...params })}`);
export const searchEmails = (params) => apiRequest(`/api/emails/search${toQueryString({ ...params })}`);
export const getEmail = (id) => apiRequest(`/api/emails/${id}`);
export const setEmailStarred = (id, starred) => apiRequest(`/api/emails/${id}/star`, {
    method: 'PATCH',
    body: { starred },
});
/** Cancels a scheduled email: removes its queued job and deletes the row. */
export const cancelEmail = (id) => apiRequest(`/api/emails/${id}`, { method: 'DELETE' });
// --- Slack ------------------------------------------------------------------
export const getSlackStatus = () => apiRequest('/api/slack/status');
export const startSlackConnect = () => apiRequest('/api/slack/start');
export const disconnectSlack = () => apiRequest('/api/slack/disconnect', { method: 'POST' });
export const sendSlackTest = () => apiRequest('/api/slack/test', { method: 'POST' });

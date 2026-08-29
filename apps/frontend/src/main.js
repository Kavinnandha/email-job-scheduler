import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ToastProvider } from './components/ui/Toast';
import './index.css';
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // The dashboard polls on its own schedule; refetching on every window
            // focus on top of that is redundant traffic.
            refetchOnWindowFocus: false,
            staleTime: 10_000,
        },
    },
});
const rootElement = document.getElementById('root');
if (!rootElement)
    throw new Error('Root element #root not found');
createRoot(rootElement).render(_jsx(StrictMode, { children: _jsx(QueryClientProvider, { client: queryClient, children: _jsx(BrowserRouter, { children: _jsx(ToastProvider, { children: _jsx(App, {}) }) }) }) }));

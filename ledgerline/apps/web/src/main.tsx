import { NotificationProvider, Toaster, TooltipProvider } from '@ledgerline/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { Shell } from './app/Shell';
import { flags } from './flags';
import './index.css';
import { DomainPlaceholder } from './routes/DomainPlaceholder';
import { Home } from './routes/Home';
import { Start } from './routes/Start';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

/**
 * Routes that show a grid load on demand: the grid engine is large and not needed for first paint.
 * Enterprise is switched on before any grid renders.
 */
function gridRoute(load: () => Promise<ComponentType>) {
  return async () => {
    const [Component, grid] = await Promise.all([load(), import('@ledgerline/ui/grid')]);
    if (flags.agGridEnterprise) await grid.enableGridEnterprise(import.meta.env.VITE_AG_GRID_LICENSE);
    return { Component };
  };
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Start /> },
      { path: 'profile', element: <Home /> },
      {
        path: 'w/:workspaceId',
        lazy: gridRoute(async () => (await import('./routes/Workspace')).WorkspaceScreen),
      },
      // Loaded on demand: the grid engine is large and not needed for first paint.
      {
        path: 'transactions',
        lazy: gridRoute(async () => (await import('./routes/Transactions')).Transactions),
      },
      { path: ':domain', element: <DomainPlaceholder /> },
    ],
  },
  // A workspace panel in its own window: no shell around it.
  {
    path: '/popout/:workspaceId/:panel',
    lazy: gridRoute(async () => (await import('./routes/Popout')).Popout),
  },
]);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <NotificationProvider>
          <RouterProvider router={router} />
          <Toaster />
        </NotificationProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);

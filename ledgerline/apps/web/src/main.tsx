import { NotificationProvider, Toaster, TooltipProvider } from '@ledgerline/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { Shell } from './app/Shell';
import { flags } from './flags';
import './index.css';
import { DomainPlaceholder } from './routes/DomainPlaceholder';
import { Home } from './routes/Home';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Home /> },
      // Loaded on demand: the grid engine is large and not needed for first paint.
      {
        path: 'transactions',
        lazy: async () => {
          // The grid engine loads with the first grid screen. Enterprise is switched on before any grid renders.
          const [route, grid] = await Promise.all([
            import('./routes/Transactions'),
            import('@ledgerline/ui/grid'),
          ]);
          if (flags.agGridEnterprise) await grid.enableGridEnterprise(import.meta.env.VITE_AG_GRID_LICENSE);
          return { Component: route.Transactions };
        },
      },
      { path: ':domain', element: <DomainPlaceholder /> },
    ],
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

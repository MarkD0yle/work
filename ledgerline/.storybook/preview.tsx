import {
  applyDensity,
  applyTheme,
  densities,
  themes,
  TooltipProvider,
  type DensityName,
  type Theme,
} from '@ledgerline/ui';
import '@ledgerline/ui/styles.css';
import type { Preview } from '@storybook/react-vite';
import { useEffect } from 'react';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: { title: 'Theme', icon: 'circlehollow', items: [...themes], dynamicTitle: true },
    },
    density: {
      description: 'Density',
      toolbar: { title: 'Density', icon: 'component', items: [...densities], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'light', density: 'standard' },
  parameters: { layout: 'padded', a11y: { test: 'error' } },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme as Theme;
      const density = context.globals.density as DensityName;
      useEffect(() => {
        applyTheme(theme);
        applyDensity(density);
      }, [theme, density]);
      return (
        <TooltipProvider>
          <Story />
        </TooltipProvider>
      );
    },
  ],
};

export default preview;

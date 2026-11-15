import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';

const meta = { title: 'Primitives/DropdownMenu', component: DropdownMenu } satisfies Meta<
  typeof DropdownMenu
>;

export default meta;
type Story = StoryObj<typeof meta>;

function Example({ open }: { open?: boolean }) {
  const [density, setDensity] = useState('standard');
  return (
    <DropdownMenu {...(open ? { defaultOpen: true } : {})}>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">Display</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Density</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={density} onValueChange={setDensity}>
          <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="standard">Standard</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Reset columns</DropdownMenuItem>
        <DropdownMenuItem disabled>Export (no rows)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const Closed: Story = { render: () => <Example /> };
export const Open: Story = { render: () => <Example open /> };

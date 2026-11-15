import type { Meta, StoryObj } from '@storybook/react-vite';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from './button';

const meta = {
  title: 'Primitives/Button',
  component: Button,
  args: { children: 'Post' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Secondary: Story = { args: { variant: 'secondary', children: 'Export' } };
export const Ghost: Story = { args: { variant: 'ghost', children: 'Cancel' } };
export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Reverse' },
  render: (args) => (
    <Button {...args}>
      <Trash2 aria-hidden />
      {args.children}
    </Button>
  ),
};
export const Disabled: Story = { args: { disabled: true } };
export const IconOnly: Story = {
  args: {
    size: 'icon',
    variant: 'secondary',
    'aria-label': 'Add transaction',
    children: <Plus aria-hidden />,
  },
};
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Button>Post</Button>
      <Button variant="secondary">Export</Button>
      <Button variant="ghost">Cancel</Button>
      <Button variant="destructive">Reverse</Button>
      <Button variant="link">View audit</Button>
    </div>
  ),
};

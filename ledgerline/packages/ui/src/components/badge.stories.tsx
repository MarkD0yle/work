import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './badge';

const meta = {
  title: 'Primitives/Badge',
  component: Badge,
  args: { children: 'Posted', status: 'good' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Good: Story = {};
export const Warning: Story = { args: { status: 'warning', children: 'Stale' } };
export const Critical: Story = { args: { status: 'critical', children: 'Breach' } };
export const Info: Story = { args: { status: 'info', children: 'Pending approval' } };
export const Neutral: Story = { args: { status: 'neutral', children: 'Unposted' } };
/** Status is always readable from the label alone; colour only reinforces it. */
export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge status="good">Posted</Badge>
      <Badge status="warning">Stale</Badge>
      <Badge status="critical">Breach</Badge>
      <Badge status="info">Pending approval</Badge>
      <Badge status="neutral">Unposted</Badge>
    </div>
  ),
};

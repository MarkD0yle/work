import type { Meta, StoryObj } from '@storybook/react-vite';
import { Separator } from './separator';

const meta = { title: 'Primitives/Separator', component: Separator } satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-64">
      <p>Trade details</p>
      <Separator className="my-2" />
      <p className="text-muted-foreground">Settlement details</p>
    </div>
  ),
};

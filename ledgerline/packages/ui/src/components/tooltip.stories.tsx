import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

const meta = { title: 'Primitives/Tooltip', component: Tooltip } satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The disabled-with-reason pattern: the control stays focusable and says why it is unavailable. */
export const DisabledWithReason: Story = {
  render: () => (
    <Tooltip defaultOpen>
      <TooltipTrigger asChild>
        <Button variant="destructive" aria-disabled>
          Reverse
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        Reversing a posted transaction needs full access on transactions.
      </TooltipContent>
    </Tooltip>
  ),
};

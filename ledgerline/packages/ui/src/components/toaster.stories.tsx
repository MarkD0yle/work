import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button';
import { toast, Toaster } from './toaster';

const meta: Meta = { title: 'Primitives/Toaster' };
export default meta;
type Story = StoryObj;

/** Lightweight confirmation only. Errors and warnings never use a toast. */
export const Confirmation: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={() => toast('Saved', 'Transaction T-0000015')}>
        Save
      </Button>
      <Button variant="secondary" onClick={() => toast('Copied 3 rows')}>
        Copy
      </Button>
      <Toaster />
    </div>
  ),
};

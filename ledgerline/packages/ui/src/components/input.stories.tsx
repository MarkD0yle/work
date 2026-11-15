import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input, Label, Select, Textarea } from './input';

const meta: Meta = { title: 'Primitives/Input' };
export default meta;

export const Fields: StoryObj = {
  render: () => (
    <div className="flex w-72 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="story-text">Reference</Label>
        <Input id="story-text" placeholder="T-0001234" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="story-invalid">Reference (invalid)</Label>
        <Input id="story-invalid" defaultValue="??" aria-invalid />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="story-select">Type</Label>
        <Select id="story-select" defaultValue="buy">
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
          <option value="fee">Fee</option>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="story-area">Reason</Label>
        <Textarea id="story-area" placeholder="Why the value was changed" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="story-disabled">Disabled</Label>
        <Input id="story-disabled" disabled defaultValue="Locked" />
      </div>
    </div>
  ),
};

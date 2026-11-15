import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

const meta: Meta = { title: 'Primitives/Tabs' };
export default meta;

export const Normal: StoryObj = {
  render: () => (
    <Tabs defaultValue="details" className="w-96 rounded-md border">
      <TabsList aria-label="Transaction sections">
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="p-3">
        Fields of the record.
      </TabsContent>
      <TabsContent value="history" className="p-3">
        Who changed what, and when.
      </TabsContent>
    </Tabs>
  ),
};

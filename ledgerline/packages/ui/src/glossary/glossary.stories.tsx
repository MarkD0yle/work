import type { Meta, StoryObj } from '@storybook/react-vite';
import { GlossaryProvider, GlossaryTerm, GlossaryText } from './glossary';

const meta: Meta = { title: 'State/Glossary' };
export default meta;

export const NewUser: StoryObj = {
  render: () => (
    <GlossaryProvider enabled>
      <p className="max-w-md">
        <GlossaryText text="Settlement date is before trade date. This transaction is posted, so reverse it to correct it." />
      </p>
      <p className="mt-2">
        Status: <GlossaryTerm>Unposted</GlossaryTerm>
      </p>
    </GlossaryProvider>
  ),
};

export const ExperiencedUser: StoryObj = {
  render: () => (
    <GlossaryProvider enabled={false}>
      <p className="max-w-md">
        <GlossaryText text="Settlement date is before trade date. This transaction is posted, so reverse it to correct it." />
      </p>
    </GlossaryProvider>
  ),
};

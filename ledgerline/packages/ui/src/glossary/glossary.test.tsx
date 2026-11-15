import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { TooltipProvider } from '../components/tooltip';
import { GlossaryProvider, GlossaryTerm, GlossaryText } from './glossary';

const ui = (enabled: boolean, node: React.ReactNode) =>
  render(
    <TooltipProvider delayDuration={0}>
      <GlossaryProvider enabled={enabled}>{node}</GlossaryProvider>
    </TooltipProvider>,
  );

describe('glossary', () => {
  beforeEach(() => sessionStorage.clear());

  it('is plain text for experienced users', () => {
    ui(false, <GlossaryText text="Settlement date is before trade date." />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Settlement date is before trade date.')).toBeInTheDocument();
  });

  it('turns the first use of each known term into a definition button for new users', () => {
    ui(true, <GlossaryText text="Settlement date is before trade date. Change the trade date." />);
    const terms = screen.getAllByRole('button');
    expect(terms.map((t) => t.textContent)).toEqual(['Settlement date', 'trade date']);
  });

  it('shows the definition on focus, then stops offering it for the rest of the session', async () => {
    const user = userEvent.setup();
    ui(true, <GlossaryTerm>Posted</GlossaryTerm>);
    await user.tab();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Recorded in the ledger');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Posted')).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem('ll-glossary-seen') ?? '[]')).toEqual(['posted']);
  });

  it('leaves unknown words alone', () => {
    ui(true, <GlossaryTerm>Widget</GlossaryTerm>);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

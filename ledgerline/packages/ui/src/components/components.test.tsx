import { density } from '@ledgerline/tokens';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { applyDensity, applyTheme, currentDensity, currentTheme } from '../lib/preferences';
import { Badge } from './badge';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

describe('Button', () => {
  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Post</Button>);
    expect(screen.getByRole('button', { name: 'Post' })).toHaveAttribute('type', 'button');
  });

  it('activates from the keyboard', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Post</Button>);
    await userEvent.tab();
    expect(screen.getByRole('button')).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('takes its height from the density token, not a fixed size', () => {
    render(<Button>Post</Button>);
    expect(screen.getByRole('button').className).toContain('h-(--ll-control-height)');
  });

  it('renders as its child with asChild', () => {
    render(
      <Button asChild>
        <a href="/transactions">Transactions</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Transactions' })).toHaveAttribute('data-slot', 'button');
  });
});

describe('Badge', () => {
  it('carries status in its text', () => {
    render(<Badge status="critical">Breach</Badge>);
    expect(screen.getByText('Breach')).toBeInTheDocument();
  });
});

describe('DropdownMenu', () => {
  function Menu() {
    const [value, setValue] = useState('standard');
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Density: {value}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value={value} onValueChange={setValue}>
            {Object.keys(density).map((d) => (
              <DropdownMenuRadioItem key={d} value={d}>
                {d}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  it('opens, moves and selects with the keyboard only', async () => {
    render(<Menu />);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('menuitemradio', { name: 'standard' })).toBeChecked();
    await userEvent.keyboard('{End}');
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('button')).toHaveTextContent('Density: comfortable');
  });
});

describe('preferences', () => {
  it('writes theme and density to <html> and reads them back', () => {
    applyTheme('dark');
    applyDensity('compact');
    expect(document.documentElement.dataset).toMatchObject({ theme: 'dark', density: 'compact' });
    expect(currentTheme()).toBe('dark');
    expect(currentDensity()).toBe('compact');
  });

  it('falls back to defaults for unknown values', () => {
    document.documentElement.dataset.theme = 'sepia';
    delete document.documentElement.dataset.density;
    expect(currentTheme()).toBe('light');
    expect(currentDensity()).toBe('standard');
  });
});

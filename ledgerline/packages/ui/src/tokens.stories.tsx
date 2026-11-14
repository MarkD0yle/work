import { colour, density, fontSize, radius, space } from '@ledgerline/tokens';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = { title: 'Foundations/Tokens' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const colourNames = Object.keys(colour.light);

export const Colour: Story = {
  render: () => (
    <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {colourNames.map((name) => (
        <li key={name} className="rounded-md border bg-card p-2">
          <div className="h-10 rounded-sm border" style={{ background: `var(--ll-${name})` }} />
          <code className="mt-1 block font-mono text-2xs">--ll-{name}</code>
        </li>
      ))}
    </ul>
  ),
};

export const Type: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      {fontSize.map((size) => (
        <p key={size} style={{ fontSize: `var(--ll-font-size-${size})` }}>
          {size}px · Settlement date before trade date
        </p>
      ))}
      <p className="tabular font-mono">1,250,000.0000 · 101.250000 · (4,512.75)</p>
    </div>
  ),
};

export const SpacingAndRadius: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        {space.map((s) => (
          <div key={s} className="flex flex-col items-center gap-1">
            <div
              className="bg-primary"
              style={{ width: `var(--ll-space-${s})`, height: `var(--ll-space-${s})` }}
            />
            <span className="text-2xs text-muted-foreground">{s}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {radius.map((r) => (
          <div
            key={r}
            className="flex size-12 items-center justify-center border bg-card text-2xs"
            style={{ borderRadius: `var(--ll-radius-${r})` }}
          >
            {r}
          </div>
        ))}
      </div>
    </div>
  ),
};

/** Switch density in the toolbar: the highlighted row is the active one. */
export const Density: Story = {
  render: () => (
    <div className="w-80 overflow-hidden rounded-md border bg-card">
      {Object.entries(density).map(([name, d]) => (
        <div
          key={name}
          className="flex items-center justify-between border-b px-3 last:border-b-0"
          style={{ height: d.rowHeight }}
        >
          <span>{name}</span>
          <span className="tabular text-muted-foreground">{d.rowHeight}px row</span>
        </div>
      ))}
      <div className="flex h-(--ll-row-height) items-center justify-between bg-muted px-(--ll-padding-x)">
        <span className="font-medium">Active density</span>
        <span className="text-muted-foreground">follows the toolbar</span>
      </div>
    </div>
  ),
};

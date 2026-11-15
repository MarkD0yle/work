/**
 * Proves the lint rules in eslint.config.js actually bite (Milestone 0 exit gate):
 * each case lints a deliberate violation at a given path and expects a specific rule to fire.
 */
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({ cwd: new URL('..', import.meta.url).pathname });

async function rulesFiredFor(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((m) => m.ruleId ?? 'parse-error');
}

const RESTRICTED = 'no-restricted-imports';

describe('import boundaries', () => {
  it.each([
    ['apps/web/src/x.ts', "import 'ag-grid-community';"],
    ['apps/web/src/x.tsx', "import { AgGridReact } from 'ag-grid-react';\nexport const y = AgGridReact;"],
    ['apps/web/src/x.ts', "import { Dialog } from 'radix-ui';\nexport const y = Dialog;"],
    ['apps/web/src/x.ts', "import * as D from '@radix-ui/react-dialog';\nexport const y = D;"],
    ['apps/web/src/x.ts', "import { colour } from '@ledgerline/tokens';\nexport const y = colour;"],
    ['packages/compositions/src/x.ts', "import 'ag-grid-enterprise';"],
    ['packages/compositions/src/x.ts', "import { Dialog } from 'radix-ui';\nexport const y = Dialog;"],
    ['packages/ui/src/components/x.ts', "import 'ag-grid-community';"],
    ['packages/ui/src/x.ts', "import { y } from '@ledgerline/compositions';\nexport const z = y;"],
    ['packages/contracts/src/x.ts', "import { z } from 'zod';\nexport const y = z;"],
    ['packages/tokens/src/x.ts', "import { clsx } from 'clsx';\nexport const y = clsx;"],
    ['apps/api/src/x.ts', "import { Button } from '@ledgerline/ui';\nexport const y = Button;"],
  ])('%s: %s is rejected', async (filePath, code) => {
    expect(await rulesFiredFor(filePath, code)).toContain(RESTRICTED);
  });

  it.each([
    ['packages/ui/src/grid/x.ts', "import 'ag-grid-community';"],
    ['packages/ui/src/components/x.ts', "import { Dialog } from 'radix-ui';\nexport const y = Dialog;"],
    ['apps/web/src/x.ts', "import { Button } from '@ledgerline/ui';\nexport const y = Button;"],
    ['apps/api/src/x.ts', "import type { User } from '@ledgerline/contracts';\nexport type Y = User;"],
    ['packages/contracts/src/x.ts', "import type { A } from './index';\nexport type Y = A;"],
  ])('%s: %s is allowed', async (filePath, code) => {
    expect(await rulesFiredFor(filePath, code)).not.toContain(RESTRICTED);
  });
});

describe('financial number handling in UI code', () => {
  it.each([
    'export const a = (1.5).toFixed(2);',
    "export const a = parseFloat('1.5');",
    "export const a = Number('1.5');",
  ])('rejects %s', async (code) => {
    expect(await rulesFiredFor('packages/ui/src/grid/x.ts', code)).toContain('no-restricted-syntax');
    expect(await rulesFiredFor('packages/compositions/src/x.ts', code)).toContain('no-restricted-syntax');
  });

  it('allows formatting only inside the financial module, which owns the precision registry', async () => {
    expect(
      await rulesFiredFor('packages/ui/src/financial/x.ts', 'export const a = (1.5).toFixed(2);'),
    ).not.toContain('no-restricted-syntax');
  });

  it('does not apply to the API, where decimal.js output is formatted', async () => {
    expect(await rulesFiredFor('apps/api/src/x.ts', 'export const a = (1.5).toFixed(2);')).not.toContain(
      'no-restricted-syntax',
    );
  });
});

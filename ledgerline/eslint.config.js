import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Dependency rules from CLAUDE.md, enforced with no-restricted-imports.
 * Each entry lists what a layer may NOT import, with the reason shown to the developer.
 */
const AG_GRID = {
  group: ['ag-grid-*', '@ag-grid-community/*', '@ag-grid-enterprise/*'],
  message: 'AG Grid may only be imported inside packages/ui/src/grid. Use LLGrid from @ledgerline/ui.',
};
const RADIX = {
  group: ['radix-ui', '@radix-ui/*'],
  message: 'Radix primitives are wrapped in @ledgerline/ui. Import the wrapped component instead.',
};
const pkg = (name, why) => ({ group: [`@ledgerline/${name}`, `@ledgerline/${name}/*`], message: why });
const ANY_PACKAGE = { regex: '^[^.]', message: 'This package imports nothing: relative imports only.' };

const boundaries = [
  { files: ['packages/contracts/src/**'], patterns: [ANY_PACKAGE] },
  { files: ['packages/tokens/src/**'], ignores: ['**/*.test.ts'], patterns: [ANY_PACKAGE] },
  {
    files: ['packages/ui/**'],
    ignores: ['packages/ui/src/grid/**'],
    patterns: [
      AG_GRID,
      pkg('compositions', 'ui must not import compositions.'),
      pkg('api', 'ui must not import the API.'),
    ],
  },
  { files: ['packages/ui/src/grid/**'], patterns: [pkg('compositions', 'ui must not import compositions.')] },
  {
    files: ['packages/compositions/**'],
    patterns: [
      AG_GRID,
      RADIX,
      pkg('tokens', 'compositions import ui and contracts only.'),
      pkg('api', 'compositions must not import the API.'),
    ],
  },
  {
    files: ['apps/web/**'],
    patterns: [
      AG_GRID,
      RADIX,
      pkg('tokens', 'apps/web gets tokens through @ledgerline/ui.'),
      pkg('api', 'apps/web talks to the API over HTTP only.'),
    ],
  },
  {
    files: ['apps/api/**'],
    patterns: [
      pkg('ui', 'apps/api may import only contracts from the frontend packages.'),
      pkg('tokens', 'apps/api may import only contracts from the frontend packages.'),
      pkg('compositions', 'apps/api may import only contracts from the frontend packages.'),
      { group: ['react', 'react-dom'], message: 'apps/api has no UI.' },
    ],
  },
];

/** Money is never a JS number: block the usual ways of formatting or parsing one in UI code. */
const FINANCIAL_MATHS = [
  {
    selector: "CallExpression[callee.property.name='toFixed']",
    message: 'Do not format financial values with toFixed. Use the precision registry and decimal.js.',
  },
  {
    selector: "CallExpression[callee.name='parseFloat']",
    message: 'Do not parse financial values with parseFloat. Use decimal.js.',
  },
  {
    selector: "CallExpression[callee.object.name='Number'][callee.property.name='parseFloat']",
    message: 'Do not parse financial values with Number.parseFloat. Use decimal.js.',
  },
  {
    selector: "CallExpression[callee.name='Number']",
    message: 'Do not convert financial values with Number(). Use decimal.js.',
  },
];

export default defineConfig([
  globalIgnores([
    '**/dist',
    '**/.tsbuild',
    '**/.turbo',
    'storybook-static',
    'playwright-report',
    'test-results',
    'coverage',
    'apps/api/drizzle',
  ]),
  {
    files: ['**/*.{ts,tsx,js}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  { files: ['**/*.{ts,tsx}'], ignores: ['apps/api/**'], extends: [reactHooks.configs.flat.recommended] },
  ...boundaries.map(({ files, ignores, patterns }) => ({
    files,
    ...(ignores ? { ignores } : {}),
    rules: { 'no-restricted-imports': ['error', { patterns }] },
  })),
  {
    files: ['packages/ui/src/**', 'packages/compositions/src/**'],
    ignores: ['**/*.test.{ts,tsx}', '**/*.stories.tsx'],
    rules: { 'no-restricted-syntax': ['error', ...FINANCIAL_MATHS] },
  },
]);

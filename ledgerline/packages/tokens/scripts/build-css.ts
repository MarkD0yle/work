import { writeFileSync } from 'node:fs';
import { renderCss } from '../src/index';

writeFileSync(new URL('../src/tokens.css', import.meta.url), renderCss());

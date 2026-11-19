/** Node globals the API code reads: Buffer for report files, process.env for settings. Imported first. */
import { Buffer } from 'buffer';

const scope = globalThis as unknown as { Buffer?: typeof Buffer; process?: { env: Record<string, string> } };
scope.Buffer ??= Buffer;
scope.process ??= { env: {} };

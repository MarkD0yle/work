/**
 * Browser stand-ins for the few Node built-ins the API touches while it starts. The demo keeps its
 * database in memory, so file paths are never used for anything.
 */
export const fileURLToPath = (url: string | URL): string => String(url);
export const dirname = (path: string): string => path.replace(/\/[^/]*$/, '') || '/';
export const existsSync = (): boolean => false;
export const mkdirSync = (): undefined => undefined;
export const rmSync = (): void => {};
export default { fileURLToPath, dirname, existsSync, mkdirSync, rmSync };

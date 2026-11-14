/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AG_GRID_LICENSE?: string;
  readonly VITE_FLAG_ASSISTANT?: string;
  readonly VITE_FLAG_APPROVALS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

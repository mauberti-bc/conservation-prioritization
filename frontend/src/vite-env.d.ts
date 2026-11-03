/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NODE_ENV: string;
  readonly VITE_NODE_OPTIONS: string;
  readonly VITE_PREFECT_API_URL: string;
  readonly VITE_ZARR_STORE_PATH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

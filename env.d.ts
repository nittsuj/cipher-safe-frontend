/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the backend API. Empty in dev to use the Vite proxy. */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

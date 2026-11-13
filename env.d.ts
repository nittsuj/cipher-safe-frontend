/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the backend API. Empty in dev to use the Vite proxy. */
  readonly VITE_API_BASE?: string
  /** 'true' to answer `/api` from the in-browser MSW mock (see src/mocks). */
  readonly VITE_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

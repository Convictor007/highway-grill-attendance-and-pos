/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string
  readonly VITE_DEV_PORT: string
  readonly VITE_PROXY_TARGET: string
  readonly VITE_MAPBOX_ACCESS_TOKEN?: string
  readonly VITE_MAPBOX_STYLE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// FIX: Replaced the `vite/client` reference with inline type definitions to work around a potential environment issue.
// This ensures that `import.meta.env` and its custom variables are correctly typed without relying on a problematic module resolution.
// /// <reference types="vite/client" />

interface ImportMetaEnv {
  // Vite-provided env variables
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;

  // Custom env variables
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string
  readonly VITE_GEMINI_DEFAULT_MODEL?: string
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Optional: install mammoth for DOCX structure extraction */
declare module 'mammoth' {
  export function extractRawText(options: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>
}

/** Optional: install xlsx for XLSX structure extraction */
declare module 'xlsx' {
  export function read(data: ArrayBuffer, opts: { type: string }): { SheetNames: string[] }
}

/** plantuml-encoder: encode PlantUML source for server URL */
declare module 'plantuml-encoder' {
  export function encode(source: string): string
  export function decode(encoded: string): string
}

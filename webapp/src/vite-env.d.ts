/// <reference types="vite/client" />

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

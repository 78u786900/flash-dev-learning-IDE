/// <reference types="vite/client" />

/** Optional: install mammoth for DOCX structure extraction */
declare module 'mammoth' {
  export function extractRawText(options: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>
}

/** Optional: install xlsx for XLSX structure extraction */
declare module 'xlsx' {
  export function read(data: ArrayBuffer, opts: { type: string }): { SheetNames: string[] }
}

/**
 * File Entity - 擴充現有 DroppedFile
 */

export interface FileChunk {
  id: string
  fileId: string
  index: number
  content: string
  type: 'text' | 'image' | 'table' | 'code'
  metadata?: {
    page?: number
    slide?: number
    sheet?: string
    startLine?: number
    endLine?: number
  }
}

export interface FileIndex {
  structure?: {
    type: 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'code' | 'text'
    pages?: number
    slides?: number
    sheets?: string[]
    chapters?: { title: string; page: number }[]
    functions?: { name: string; line: number }[]
  }
  chunks?: FileChunk[]
  embeddingsReady: boolean
  indexedAt?: number
}

export interface FileVersion {
  versionId: string
  fileId: string
  timestamp: number
  diff?: string
  blobUrl: string
  metadata: {
    changedBy: 'user' | 'agent'
    skillName?: string
    changeDescription: string
  }
}

export interface FileEntity {
  // ✅ 現有欄位
  id: string
  name: string
  type: string
  url: string
  size: number
  addedAt: number
  
  // 🆕 新增欄位
  mime: string
  version: number
  versions: FileVersion[]
  index: FileIndex
  metadata: {
    pages?: number
    duration?: number
    dimensions?: { w: number; h: number }
    language?: string
    encoding?: string
  }
}

// Helper: 從現有 DroppedFile 升級到 FileEntity
export function upgradeDroppedFile(dropped: {
  id: string
  name: string
  type: string
  url: string
  size: number
  addedAt: number
}): FileEntity {
  return {
    ...dropped,
    mime: dropped.type,
    version: 1,
    versions: [{
      versionId: `v1-${dropped.id}`,
      fileId: dropped.id,
      timestamp: dropped.addedAt,
      blobUrl: dropped.url,
      metadata: {
        changedBy: 'user',
        changeDescription: 'Initial upload'
      }
    }],
    index: {
      embeddingsReady: false
    },
    metadata: {}
  }
}

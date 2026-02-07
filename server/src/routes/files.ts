import { Router, Response } from 'express'
import multer from 'multer'
import { createDriveService } from '../services/googleDrive.js'
import type { AuthenticatedRequest, DroppedFileMetadata } from '../types.js'

export const filesRouter = Router()

// Configure multer for memory storage (500MB for video files; Google Drive supports up to 5TB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  }
})

/**
 * GET /api/files
 * List all files in the user's flash.dev folder
 */
filesRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.accessToken) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const driveService = createDriveService(req.accessToken)
    
    // Get storage data for metadata
    const storageData = await driveService.loadStorageData()
    const fileMetadata = storageData?.fileMetadata || []
    
    // Get actual files from Drive
    const driveFiles = await driveService.listFiles()
    
    // Merge metadata with drive files
    const files = driveFiles.map(df => {
      const meta = fileMetadata.find(m => m.driveFileId === df.id)
      return {
        id: meta?.id || df.id,
        name: df.name,
        type: df.mimeType,
        size: parseInt(df.size, 10),
        addedAt: meta?.addedAt || Date.now(),
        driveFileId: df.id
      }
    })
    
    res.json(files)
  } catch (error: any) {
    console.error('List files error:', error)
    res.status(500).json({ error: 'Failed to list files', message: error.message })
  }
})

/**
 * POST /api/files
 * Upload a file to Google Drive
 */
filesRouter.post('/', upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.accessToken) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    const driveService = createDriveService(req.accessToken)
    
    // Upload file to Drive
    const uploaded = await driveService.uploadFile(
      req.file.originalname,
      req.file.mimetype,
      req.file.buffer
    )
    
    // Preserve client id when syncing local→cloud (form field "id"), else generate new
    const clientId = req.body?.id
    const fileId = typeof clientId === 'string' && clientId ? clientId : `f${Date.now()}_${Math.random().toString(36).slice(2)}`
    const clientAddedAt = req.body?.addedAt
    const addedAt = typeof clientAddedAt === 'string' && /^\d+$/.test(clientAddedAt) ? parseInt(clientAddedAt, 10) : Date.now()
    const metadata: DroppedFileMetadata = {
      id: fileId,
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
      addedAt,
      driveFileId: uploaded.id
    }
    
    // Update storage with new file metadata
    const storageData = await driveService.loadStorageData() || {
      notes: [],
      timeline: [],
      chatThreads: [],
      canvasOverlays: {},
      fileMetadata: []
    }
    storageData.fileMetadata.push(metadata)
    await driveService.saveStorageData(storageData)
    
    // Get download URL
    const url = await driveService.getFileUrl(uploaded.id)
    
    res.json({
      id: fileId,
      name: metadata.name,
      type: metadata.type,
      size: metadata.size,
      addedAt: metadata.addedAt,
      driveFileId: uploaded.id,
      url
    })
  } catch (error: any) {
    console.error('Upload file error:', error)
    res.status(500).json({ error: 'Failed to upload file', message: error.message })
  }
})

/**
 * GET /api/files/:id
 * Download a file from Google Drive (id can be app file id or Drive file id)
 */
filesRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.accessToken) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { id } = req.params
    const driveService = createDriveService(req.accessToken)
    
    let driveFileId: string | null = null
    const storageData = await driveService.loadStorageData()
    const meta = storageData?.fileMetadata.find(m => m.id === id || m.driveFileId === id)
    if (meta?.driveFileId) {
      driveFileId = meta.driveFileId
    } else {
      // Id may be a Drive file id (e.g. file listed without metadata)
      driveFileId = id
    }
    
    const { data, mimeType, name } = await driveService.downloadFile(driveFileId)
    
    res.setHeader('Content-Type', mimeType)
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(name)}"`)
    res.send(data)
  } catch (error: any) {
    console.error('Download file error:', error)
    if (error.code === 404) {
      return res.status(404).json({ error: 'File not found' })
    }
    res.status(500).json({ error: 'Failed to download file', message: error.message })
  }
})

/**
 * GET /api/files/:id/url
 * Get a shareable URL for a file (id can be app file id or Drive file id)
 */
filesRouter.get('/:id/url', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.accessToken) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { id } = req.params
    const driveService = createDriveService(req.accessToken)
    
    let driveFileId: string | null = null
    const storageData = await driveService.loadStorageData()
    const meta = storageData?.fileMetadata.find(m => m.id === id || m.driveFileId === id)
    if (meta?.driveFileId) {
      driveFileId = meta.driveFileId
    } else {
      driveFileId = id
    }
    
    const url = await driveService.getFileUrl(driveFileId)
    res.json({ url })
  } catch (error: any) {
    console.error('Get file URL error:', error)
    res.status(500).json({ error: 'Failed to get file URL', message: error.message })
  }
})

/**
 * PUT /api/files/:id
 * Rename a file
 */
filesRouter.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.accessToken) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { id } = req.params
    const { name } = req.body
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Name is required' })
    }

    const driveService = createDriveService(req.accessToken)
    
    // Get storage data to find driveFileId
    const storageData = await driveService.loadStorageData()
    if (!storageData) {
      return res.status(404).json({ error: 'Storage not found' })
    }
    
    const metaIndex = storageData.fileMetadata.findIndex(m => m.id === id || m.driveFileId === id)
    if (metaIndex === -1) {
      return res.status(404).json({ error: 'File not found' })
    }
    
    const meta = storageData.fileMetadata[metaIndex]
    
    // Rename in Drive
    await driveService.renameFile(meta.driveFileId!, name.trim())
    
    // Update metadata
    storageData.fileMetadata[metaIndex] = { ...meta, name: name.trim() }
    await driveService.saveStorageData(storageData)
    
    res.json({ success: true, name: name.trim() })
  } catch (error: any) {
    console.error('Rename file error:', error)
    res.status(500).json({ error: 'Failed to rename file', message: error.message })
  }
})

/**
 * DELETE /api/files/:id
 * Delete a file (id can be app file id or Drive file id)
 */
filesRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.accessToken) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { id } = req.params
    const driveService = createDriveService(req.accessToken)
    
    const storageData = await driveService.loadStorageData()
    const meta = storageData?.fileMetadata?.find(m => m.id === id || m.driveFileId === id)
    let driveFileId: string | null = meta?.driveFileId ?? null

    // Orphaned file: in Drive but not in fileMetadata (e.g. upload succeeded but metadata save failed)
    if (!driveFileId) {
      const driveFiles = await driveService.listFiles()
      const df = driveFiles.find(f => f.id === id)
      if (df) driveFileId = df.id
    }

    if (!driveFileId) {
      return res.status(404).json({ error: 'File not found' })
    }
    
    await driveService.deleteFile(driveFileId)
    
    // Remove from metadata if present
    if (storageData && meta) {
      storageData.fileMetadata = storageData.fileMetadata.filter(m => m.id !== id && m.driveFileId !== id)
      await driveService.saveStorageData(storageData)
    }
    
    res.json({ success: true })
  } catch (error: any) {
    console.error('Delete file error:', error)
    if (error.code === 404) {
      return res.status(404).json({ error: 'File not found' })
    }
    res.status(500).json({ error: 'Failed to delete file', message: error.message })
  }
})

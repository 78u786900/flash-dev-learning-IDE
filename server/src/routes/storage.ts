import { Router, Response } from 'express'
import { createDriveService } from '../services/googleDrive.js'
import type { AuthenticatedRequest, StorageData, Note, TimelineAction, StoredChatThread, CanvasOverlayMemo } from '../types.js'

export const storageRouter = Router()

const DEFAULT_STORAGE: StorageData = {
  notes: [],
  timeline: [],
  chatThreads: [],
  canvasOverlays: {},
  fileMetadata: []
}

/**
 * GET /api/storage/summary
 * Lightweight summary for cloud storage display (notes, files, chat counts)
 */
storageRouter.get('/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.accessToken) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const driveService = createDriveService(req.accessToken)
    const [data, files, quota] = await Promise.all([
      driveService.loadStorageData(),
      driveService.listFiles(),
      driveService.getStorageQuota()
    ])

    const notesCount = data?.notes?.length ?? 0
    const timelineCount = data?.timeline?.length ?? 0
    const chatThreadsCount = data?.chatThreads?.length ?? 0
    const totalMessages = (data?.chatThreads ?? []).reduce((sum, t) => sum + (t.messages?.length ?? 0), 0)
    const filesCount = files?.length ?? 0
    const overlaysCount = Object.keys(data?.canvasOverlays ?? {}).length

    res.json({
      ok: true,
      notesCount,
      timelineCount,
      chatThreadsCount,
      totalMessages,
      filesCount,
      overlaysCount,
      storageQuota: quota ? { limit: quota.limit, usage: quota.usage } : null,
    })
  } catch (error: any) {
    console.error('Storage summary error:', error)
    res.status(500).json({ ok: false, error: error?.message })
  }
})

/** Deterministic JSON stringify for comparison (sort keys) */
function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return JSON.stringify(obj)
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']'
  if (typeof obj === 'object') {
    const keys = Object.keys(obj).sort()
    return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify((obj as Record<string, unknown>)[k])).join(',') + '}'
  }
  return JSON.stringify(obj)
}

/**
 * POST /api/storage/verify
 * Compare client state with what's stored on Drive. Returns match status and counts.
 */
storageRouter.post('/verify', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.accessToken) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const body = req.body as {
      notes?: unknown[]
      timeline?: unknown[]
      chatThreads?: unknown[]
      canvasOverlays?: Record<string, unknown[]>
      fileMetadata?: Array<{ id: string; name: string; type: string; size: number; addedAt: number; driveFileId?: string }>
    }
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid body: expected { notes, timeline, chatThreads, canvasOverlays, fileMetadata? }' })
    }

    const driveService = createDriveService(req.accessToken)
    const driveData = await driveService.loadStorageData()

    const clientState = {
      notes: body.notes ?? [],
      timeline: body.timeline ?? [],
      chatThreads: body.chatThreads ?? [],
      canvasOverlays: body.canvasOverlays ?? {},
      fileMetadata: (body.fileMetadata ?? []).map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        size: f.size,
        addedAt: f.addedAt,
        driveFileId: f.driveFileId
      }))
    }

    const driveState = driveData
      ? {
          notes: driveData.notes ?? [],
          timeline: driveData.timeline ?? [],
          chatThreads: driveData.chatThreads ?? [],
          canvasOverlays: driveData.canvasOverlays ?? {},
          fileMetadata: (driveData.fileMetadata ?? []).map(f => ({
            id: f.id,
            name: f.name,
            type: f.type,
            size: f.size,
            addedAt: f.addedAt,
            driveFileId: f.driveFileId
          }))
        }
      : { notes: [], timeline: [], chatThreads: [], canvasOverlays: {}, fileMetadata: [] }

    const notesMatch = stableStringify(clientState.notes) === stableStringify(driveState.notes)
    const timelineMatch = stableStringify(clientState.timeline) === stableStringify(driveState.timeline)
    const chatMatch = stableStringify(clientState.chatThreads) === stableStringify(driveState.chatThreads)
    const overlaysMatch = stableStringify(clientState.canvasOverlays) === stableStringify(driveState.canvasOverlays)
    const filesMatch = stableStringify(clientState.fileMetadata) === stableStringify(driveState.fileMetadata)
    const match = notesMatch && timelineMatch && chatMatch && overlaysMatch && filesMatch

    const driveCounts = {
      notes: driveState.notes.length,
      timeline: driveState.timeline.length,
      chatThreads: driveState.chatThreads.length,
      totalMessages: (driveState.chatThreads as { messages?: unknown[] }[]).reduce(
        (sum, t) => sum + (t.messages?.length ?? 0),
        0
      ),
      overlaysKeys: Object.keys(driveState.canvasOverlays).length,
      filesCount: driveState.fileMetadata.length
    }

    const clientCounts = {
      notes: clientState.notes.length,
      timeline: clientState.timeline.length,
      chatThreads: clientState.chatThreads.length,
      totalMessages: (clientState.chatThreads as { messages?: unknown[] }[]).reduce(
        (sum, t) => sum + (t.messages?.length ?? 0),
        0
      ),
      overlaysKeys: Object.keys(clientState.canvasOverlays).length,
      filesCount: clientState.fileMetadata.length
    }

    res.json({
      ok: true,
      match,
      driveReachable: !!driveData,
      details: { notesMatch, timelineMatch, chatMatch, overlaysMatch, filesMatch },
      driveCounts,
      clientCounts
    })
  } catch (error: any) {
    console.error('Storage verify error:', error)
    res.status(500).json({ ok: false, error: error?.message })
  }
})

/**
 * GET /api/storage
 * Load all storage data from Google Drive
 */
storageRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.accessToken) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const driveService = createDriveService(req.accessToken)
    const data = await driveService.loadStorageData()
    
    res.json(data || DEFAULT_STORAGE)
  } catch (error: any) {
    console.error('Load storage error:', error)
    res.status(500).json({ error: 'Failed to load storage', message: error.message })
  }
})

/**
 * PUT /api/storage
 * Save all storage data to Google Drive
 */
storageRouter.put('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.accessToken) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const data: StorageData = req.body
    
    // Validate data structure
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid storage data' })
    }

    const driveService = createDriveService(req.accessToken)
    await driveService.saveStorageData({
      notes: data.notes || [],
      timeline: data.timeline || [],
      chatThreads: data.chatThreads || [],
      canvasOverlays: data.canvasOverlays || {},
      fileMetadata: data.fileMetadata || []
    })
    
    res.json({ success: true })
  } catch (error: any) {
    console.error('Save storage error:', error)
    res.status(500).json({ error: 'Failed to save storage', message: error.message })
  }
})

// Individual resource endpoints for granular updates

/**
 * GET /api/storage/notes
 */
storageRouter.get('/notes', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.accessToken) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const driveService = createDriveService(req.accessToken)
    const data = await driveService.loadStorageData()
    
    res.json(data?.notes || [])
  } catch (error: any) {
    console.error('Load notes error:', error)
    res.status(500).json({ error: 'Failed to load notes', message: error.message })
  }
})

/**
 * PUT /api/storage/notes
 */
storageRouter.put('/notes', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.accessToken) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const notes: Note[] = req.body
    if (!Array.isArray(notes)) {
      return res.status(400).json({ error: 'Notes must be an array' })
    }

    const driveService = createDriveService(req.accessToken)
    const data = await driveService.loadStorageData() || DEFAULT_STORAGE
    data.notes = notes
    await driveService.saveStorageData(data)
    
    res.json({ success: true })
  } catch (error: any) {
    console.error('Save notes error:', error)
    res.status(500).json({ error: 'Failed to save notes', message: error.message })
  }
})

/**
 * GET /api/storage/timeline
 */
storageRouter.get('/timeline', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.accessToken) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const driveService = createDriveService(req.accessToken)
    const data = await driveService.loadStorageData()
    
    res.json(data?.timeline || [])
  } catch (error: any) {
    console.error('Load timeline error:', error)
    res.status(500).json({ error: 'Failed to load timeline', message: error.message })
  }
})

/**
 * PUT /api/storage/timeline
 */
storageRouter.put('/timeline', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.accessToken) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const timeline: TimelineAction[] = req.body
    if (!Array.isArray(timeline)) {
      return res.status(400).json({ error: 'Timeline must be an array' })
    }

    const driveService = createDriveService(req.accessToken)
    const data = await driveService.loadStorageData() || DEFAULT_STORAGE
    data.timeline = timeline.slice(-200) // Cap at 200
    await driveService.saveStorageData(data)
    
    res.json({ success: true })
  } catch (error: any) {
    console.error('Save timeline error:', error)
    res.status(500).json({ error: 'Failed to save timeline', message: error.message })
  }
})

/**
 * GET /api/storage/chat
 */
storageRouter.get('/chat', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.accessToken) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const driveService = createDriveService(req.accessToken)
    const data = await driveService.loadStorageData()
    
    res.json(data?.chatThreads || [])
  } catch (error: any) {
    console.error('Load chat error:', error)
    res.status(500).json({ error: 'Failed to load chat', message: error.message })
  }
})

/**
 * PUT /api/storage/chat
 */
storageRouter.put('/chat', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.accessToken) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const chatThreads: StoredChatThread[] = req.body
    if (!Array.isArray(chatThreads)) {
      return res.status(400).json({ error: 'Chat threads must be an array' })
    }

    const driveService = createDriveService(req.accessToken)
    const data = await driveService.loadStorageData() || DEFAULT_STORAGE
    // Cap threads and messages
    data.chatThreads = chatThreads.slice(-100).map(t => ({
      ...t,
      messages: t.messages.slice(-100)
    }))
    await driveService.saveStorageData(data)
    
    res.json({ success: true })
  } catch (error: any) {
    console.error('Save chat error:', error)
    res.status(500).json({ error: 'Failed to save chat', message: error.message })
  }
})

/**
 * GET /api/storage/overlays
 */
storageRouter.get('/overlays', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.accessToken) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const driveService = createDriveService(req.accessToken)
    const data = await driveService.loadStorageData()
    
    res.json(data?.canvasOverlays || {})
  } catch (error: any) {
    console.error('Load overlays error:', error)
    res.status(500).json({ error: 'Failed to load overlays', message: error.message })
  }
})

/**
 * PUT /api/storage/overlays
 */
storageRouter.put('/overlays', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.accessToken) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const canvasOverlays: Record<string, CanvasOverlayMemo[]> = req.body
    if (!canvasOverlays || typeof canvasOverlays !== 'object') {
      return res.status(400).json({ error: 'Canvas overlays must be an object' })
    }

    const driveService = createDriveService(req.accessToken)
    const data = await driveService.loadStorageData() || DEFAULT_STORAGE
    data.canvasOverlays = canvasOverlays
    await driveService.saveStorageData(data)
    
    res.json({ success: true })
  } catch (error: any) {
    console.error('Save overlays error:', error)
    res.status(500).json({ error: 'Failed to save overlays', message: error.message })
  }
})

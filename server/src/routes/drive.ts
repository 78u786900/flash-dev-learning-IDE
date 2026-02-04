import { Router, Response } from 'express'
import { createDriveService } from '../services/googleDrive.js'
import type { AuthenticatedRequest } from '../types.js'

export const driveRouter = Router()

/**
 * GET /api/drive/ensure-folder
 * Ensures the app folder exists in Google Drive. Use this to debug "folder not showing".
 * Returns folderId if successful, or error details.
 */
driveRouter.get('/ensure-folder', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.accessToken) {
      return res.status(401).json({ ok: false, error: 'Not authenticated' })
    }

    const driveService = createDriveService(req.accessToken)
    const folderId = await driveService.getOrCreateAppFolder()

    res.json({
      ok: true,
      folderId,
      message: 'Folder exists or was created. Check Google Drive (My Drive) for "flash.dev".'
    })
  } catch (error: any) {
    console.error('Ensure folder error:', error?.message || error)
    res.status(500).json({
      ok: false,
      error: error?.message || 'Failed to ensure folder',
      code: error?.code,
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    })
  }
})

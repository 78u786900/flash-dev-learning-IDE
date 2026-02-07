import { Router } from 'express';
import { createDriveService } from '../services/googleDrive.js';
export const driveRouter = Router();
/**
 * GET /api/drive/ensure-appdata
 * Verifies app data folder (appDataFolder) is accessible. Use for debugging.
 */
driveRouter.get('/ensure-appdata', async (req, res) => {
    try {
        if (!req.accessToken) {
            return res.status(401).json({ ok: false, error: 'Not authenticated' });
        }
        const driveService = createDriveService(req.accessToken);
        const data = await driveService.loadStorageData();
        res.json({
            ok: true,
            message: 'App data folder ready.',
            hasStorage: !!data
        });
    }
    catch (error) {
        console.error('Ensure appdata error:', error?.message || error);
        res.status(500).json({
            ok: false,
            error: error?.message || 'Failed to access app data',
            code: error?.code,
            details: process.env.NODE_ENV === 'development' ? String(error) : undefined
        });
    }
});
//# sourceMappingURL=drive.js.map
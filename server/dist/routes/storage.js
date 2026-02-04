import { Router } from 'express';
import { createDriveService } from '../services/googleDrive.js';
export const storageRouter = Router();
const DEFAULT_STORAGE = {
    notes: [],
    timeline: [],
    chatThreads: [],
    canvasOverlays: {},
    fileMetadata: []
};
/**
 * GET /api/storage
 * Load all storage data from Google Drive
 */
storageRouter.get('/', async (req, res) => {
    try {
        if (!req.accessToken) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const driveService = createDriveService(req.accessToken);
        const data = await driveService.loadStorageData();
        res.json(data || DEFAULT_STORAGE);
    }
    catch (error) {
        console.error('Load storage error:', error);
        res.status(500).json({ error: 'Failed to load storage', message: error.message });
    }
});
/**
 * PUT /api/storage
 * Save all storage data to Google Drive
 */
storageRouter.put('/', async (req, res) => {
    try {
        if (!req.accessToken) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const data = req.body;
        // Validate data structure
        if (!data || typeof data !== 'object') {
            return res.status(400).json({ error: 'Invalid storage data' });
        }
        const driveService = createDriveService(req.accessToken);
        await driveService.saveStorageData({
            notes: data.notes || [],
            timeline: data.timeline || [],
            chatThreads: data.chatThreads || [],
            canvasOverlays: data.canvasOverlays || {},
            fileMetadata: data.fileMetadata || []
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Save storage error:', error);
        res.status(500).json({ error: 'Failed to save storage', message: error.message });
    }
});
// Individual resource endpoints for granular updates
/**
 * GET /api/storage/notes
 */
storageRouter.get('/notes', async (req, res) => {
    try {
        if (!req.accessToken) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const driveService = createDriveService(req.accessToken);
        const data = await driveService.loadStorageData();
        res.json(data?.notes || []);
    }
    catch (error) {
        console.error('Load notes error:', error);
        res.status(500).json({ error: 'Failed to load notes', message: error.message });
    }
});
/**
 * PUT /api/storage/notes
 */
storageRouter.put('/notes', async (req, res) => {
    try {
        if (!req.accessToken) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const notes = req.body;
        if (!Array.isArray(notes)) {
            return res.status(400).json({ error: 'Notes must be an array' });
        }
        const driveService = createDriveService(req.accessToken);
        const data = await driveService.loadStorageData() || DEFAULT_STORAGE;
        data.notes = notes;
        await driveService.saveStorageData(data);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Save notes error:', error);
        res.status(500).json({ error: 'Failed to save notes', message: error.message });
    }
});
/**
 * GET /api/storage/timeline
 */
storageRouter.get('/timeline', async (req, res) => {
    try {
        if (!req.accessToken) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const driveService = createDriveService(req.accessToken);
        const data = await driveService.loadStorageData();
        res.json(data?.timeline || []);
    }
    catch (error) {
        console.error('Load timeline error:', error);
        res.status(500).json({ error: 'Failed to load timeline', message: error.message });
    }
});
/**
 * PUT /api/storage/timeline
 */
storageRouter.put('/timeline', async (req, res) => {
    try {
        if (!req.accessToken) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const timeline = req.body;
        if (!Array.isArray(timeline)) {
            return res.status(400).json({ error: 'Timeline must be an array' });
        }
        const driveService = createDriveService(req.accessToken);
        const data = await driveService.loadStorageData() || DEFAULT_STORAGE;
        data.timeline = timeline.slice(-200); // Cap at 200
        await driveService.saveStorageData(data);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Save timeline error:', error);
        res.status(500).json({ error: 'Failed to save timeline', message: error.message });
    }
});
/**
 * GET /api/storage/chat
 */
storageRouter.get('/chat', async (req, res) => {
    try {
        if (!req.accessToken) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const driveService = createDriveService(req.accessToken);
        const data = await driveService.loadStorageData();
        res.json(data?.chatThreads || []);
    }
    catch (error) {
        console.error('Load chat error:', error);
        res.status(500).json({ error: 'Failed to load chat', message: error.message });
    }
});
/**
 * PUT /api/storage/chat
 */
storageRouter.put('/chat', async (req, res) => {
    try {
        if (!req.accessToken) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const chatThreads = req.body;
        if (!Array.isArray(chatThreads)) {
            return res.status(400).json({ error: 'Chat threads must be an array' });
        }
        const driveService = createDriveService(req.accessToken);
        const data = await driveService.loadStorageData() || DEFAULT_STORAGE;
        // Cap threads and messages
        data.chatThreads = chatThreads.slice(-100).map(t => ({
            ...t,
            messages: t.messages.slice(-100)
        }));
        await driveService.saveStorageData(data);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Save chat error:', error);
        res.status(500).json({ error: 'Failed to save chat', message: error.message });
    }
});
/**
 * GET /api/storage/overlays
 */
storageRouter.get('/overlays', async (req, res) => {
    try {
        if (!req.accessToken) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const driveService = createDriveService(req.accessToken);
        const data = await driveService.loadStorageData();
        res.json(data?.canvasOverlays || {});
    }
    catch (error) {
        console.error('Load overlays error:', error);
        res.status(500).json({ error: 'Failed to load overlays', message: error.message });
    }
});
/**
 * PUT /api/storage/overlays
 */
storageRouter.put('/overlays', async (req, res) => {
    try {
        if (!req.accessToken) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const canvasOverlays = req.body;
        if (!canvasOverlays || typeof canvasOverlays !== 'object') {
            return res.status(400).json({ error: 'Canvas overlays must be an object' });
        }
        const driveService = createDriveService(req.accessToken);
        const data = await driveService.loadStorageData() || DEFAULT_STORAGE;
        data.canvasOverlays = canvasOverlays;
        await driveService.saveStorageData(data);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Save overlays error:', error);
        res.status(500).json({ error: 'Failed to save overlays', message: error.message });
    }
});
//# sourceMappingURL=storage.js.map
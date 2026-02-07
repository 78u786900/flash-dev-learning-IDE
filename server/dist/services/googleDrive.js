import { google } from 'googleapis';
import { Readable } from 'stream';
const DATA_FILE_NAME = 'storage.json';
export class GoogleDriveService {
    drive;
    constructor(accessToken) {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });
        this.drive = google.drive({ version: 'v3', auth });
    }
    /**
     * Find a file by name in the app data folder
     */
    async findFileByName(fileName) {
        const response = await this.drive.files.list({
            q: `name='${fileName}' and 'appDataFolder' in parents and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'appDataFolder'
        });
        if (response.data.files && response.data.files.length > 0) {
            return response.data.files[0].id;
        }
        return null;
    }
    /**
     * Load storage data from Google Drive
     */
    async loadStorageData() {
        try {
            const fileId = await this.findFileByName(DATA_FILE_NAME);
            if (!fileId)
                return null;
            const response = await this.drive.files.get({
                fileId,
                alt: 'media'
            });
            const raw = response.data;
            if (raw === undefined || raw === null)
                return null;
            if (typeof raw === 'object' && !Buffer.isBuffer(raw) && !Array.isArray(raw)) {
                return raw;
            }
            const str = typeof raw === 'string' ? raw : (Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw));
            return JSON.parse(str);
        }
        catch (error) {
            if (error.code === 404)
                return null;
            throw error;
        }
    }
    /**
     * Save storage data to Google Drive (appDataFolder)
     */
    async saveStorageData(data) {
        const fileId = await this.findFileByName(DATA_FILE_NAME);
        const media = {
            mimeType: 'application/json',
            body: Readable.from([JSON.stringify(data, null, 2)])
        };
        if (fileId) {
            await this.drive.files.update({
                fileId,
                media
            });
        }
        else {
            await this.drive.files.create({
                requestBody: {
                    name: DATA_FILE_NAME,
                    parents: ['appDataFolder']
                },
                media,
                fields: 'id'
            });
        }
    }
    /**
     * Upload a file (PDF, image, etc.) to Google Drive (appDataFolder)
     */
    async uploadFile(fileName, mimeType, content, fileId) {
        const media = {
            mimeType,
            body: Readable.from([content])
        };
        if (fileId) {
            const response = await this.drive.files.update({
                fileId,
                requestBody: { name: fileName },
                media,
                fields: 'id, name'
            });
            return { id: response.data.id, name: response.data.name };
        }
        const response = await this.drive.files.create({
            requestBody: {
                name: fileName,
                parents: ['appDataFolder']
            },
            media,
            fields: 'id, name'
        });
        return { id: response.data.id, name: response.data.name };
    }
    /**
     * Download a file from Google Drive
     */
    async downloadFile(fileId) {
        // Get file metadata first
        const metadata = await this.drive.files.get({
            fileId,
            fields: 'name, mimeType'
        });
        // Download file content
        const response = await this.drive.files.get({
            fileId,
            alt: 'media'
        }, {
            responseType: 'arraybuffer'
        });
        return {
            data: Buffer.from(response.data),
            mimeType: metadata.data.mimeType || 'application/octet-stream',
            name: metadata.data.name || 'unknown'
        };
    }
    /**
     * Delete a file from Google Drive
     */
    async deleteFile(fileId) {
        await this.drive.files.delete({ fileId });
    }
    /**
     * Rename a file in Google Drive
     */
    async renameFile(fileId, newName) {
        await this.drive.files.update({
            fileId,
            requestBody: { name: newName }
        });
    }
    /**
     * List all files in the app data folder (excludes storage.json)
     */
    async listFiles() {
        const response = await this.drive.files.list({
            q: `'appDataFolder' in parents and trashed=false and name != '${DATA_FILE_NAME}'`,
            fields: 'files(id, name, mimeType, size)',
            spaces: 'appDataFolder',
            orderBy: 'createdTime desc'
        });
        return (response.data.files || []).map(f => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            size: f.size || '0'
        }));
    }
    /**
     * Get URL for a file. appDataFolder files cannot be shared publicly,
     * so we return empty string - frontend must use download API to get blob URL.
     */
    async getFileUrl(_fileId) {
        return '';
    }
    /**
     * Get user's Drive storage quota (limit and usage in bytes).
     * Returns null if about.get is not allowed (e.g. scope restriction).
     */
    async getStorageQuota() {
        try {
            const res = await this.drive.about.get({
                fields: 'storageQuota(limit,usage)'
            });
            const q = res.data.storageQuota;
            if (!q)
                return null;
            const limit = typeof q.limit === 'string' ? parseInt(q.limit, 10) : (q.limit ?? 0);
            const usage = typeof q.usage === 'string' ? parseInt(q.usage, 10) : (q.usage ?? 0);
            if (limit <= 0)
                return null;
            return { limit, usage };
        }
        catch {
            return null;
        }
    }
}
export function createDriveService(accessToken) {
    return new GoogleDriveService(accessToken);
}
//# sourceMappingURL=googleDrive.js.map
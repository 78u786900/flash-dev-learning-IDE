import { google } from 'googleapis';
import { Readable } from 'stream';
const FOLDER_NAME = process.env.DRIVE_FOLDER_NAME || 'flash.dev';
const DATA_FILE_NAME = 'storage.json';
export class GoogleDriveService {
    drive;
    folderId = null;
    constructor(accessToken) {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });
        this.drive = google.drive({ version: 'v3', auth });
    }
    /**
     * Get or create the app folder in Google Drive
     */
    async getOrCreateAppFolder() {
        if (this.folderId)
            return this.folderId;
        // Search for existing folder
        const response = await this.drive.files.list({
            q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });
        if (response.data.files && response.data.files.length > 0) {
            this.folderId = response.data.files[0].id;
            return this.folderId;
        }
        // Create new folder
        const folderMetadata = {
            name: FOLDER_NAME,
            mimeType: 'application/vnd.google-apps.folder'
        };
        const folder = await this.drive.files.create({
            requestBody: folderMetadata,
            fields: 'id'
        });
        this.folderId = folder.data.id;
        console.log(`[Drive] Created folder "${FOLDER_NAME}" id=${this.folderId}`);
        return this.folderId;
    }
    /**
     * Find a file by name in the app folder
     */
    async findFileByName(fileName) {
        const folderId = await this.getOrCreateAppFolder();
        const response = await this.drive.files.list({
            q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
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
     * Save storage data to Google Drive
     */
    async saveStorageData(data) {
        const folderId = await this.getOrCreateAppFolder();
        const fileId = await this.findFileByName(DATA_FILE_NAME);
        const media = {
            mimeType: 'application/json',
            body: Readable.from([JSON.stringify(data, null, 2)])
        };
        if (fileId) {
            // Update existing file
            await this.drive.files.update({
                fileId,
                media
            });
        }
        else {
            // Create new file
            await this.drive.files.create({
                requestBody: {
                    name: DATA_FILE_NAME,
                    parents: [folderId]
                },
                media,
                fields: 'id'
            });
        }
    }
    /**
     * Upload a file (PDF, image, etc.) to Google Drive
     */
    async uploadFile(fileName, mimeType, content, fileId) {
        const folderId = await this.getOrCreateAppFolder();
        const media = {
            mimeType,
            body: Readable.from([content])
        };
        if (fileId) {
            // Update existing file
            const response = await this.drive.files.update({
                fileId,
                requestBody: { name: fileName },
                media,
                fields: 'id, name'
            });
            return { id: response.data.id, name: response.data.name };
        }
        // Create new file
        const response = await this.drive.files.create({
            requestBody: {
                name: fileName,
                parents: [folderId]
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
     * List all files in the app folder
     */
    async listFiles() {
        const folderId = await this.getOrCreateAppFolder();
        const response = await this.drive.files.list({
            q: `'${folderId}' in parents and trashed=false and name != '${DATA_FILE_NAME}'`,
            fields: 'files(id, name, mimeType, size)',
            spaces: 'drive',
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
     * Get shareable link for a file
     */
    async getFileUrl(fileId) {
        // Make file accessible
        await this.drive.permissions.create({
            fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone'
            }
        }).catch(() => {
            // Permission might already exist
        });
        return `https://drive.google.com/uc?id=${fileId}&export=download`;
    }
}
export function createDriveService(accessToken) {
    return new GoogleDriveService(accessToken);
}
//# sourceMappingURL=googleDrive.js.map
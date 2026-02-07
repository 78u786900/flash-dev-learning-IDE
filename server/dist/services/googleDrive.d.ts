import type { StorageData } from '../types.js';
export declare class GoogleDriveService {
    private drive;
    constructor(accessToken: string);
    /**
     * Find a file by name in the app data folder
     */
    findFileByName(fileName: string): Promise<string | null>;
    /**
     * Load storage data from Google Drive
     */
    loadStorageData(): Promise<StorageData | null>;
    /**
     * Save storage data to Google Drive (appDataFolder)
     */
    saveStorageData(data: StorageData): Promise<void>;
    /**
     * Upload a file (PDF, image, etc.) to Google Drive (appDataFolder)
     */
    uploadFile(fileName: string, mimeType: string, content: Buffer, fileId?: string): Promise<{
        id: string;
        name: string;
    }>;
    /**
     * Download a file from Google Drive
     */
    downloadFile(fileId: string): Promise<{
        data: Buffer;
        mimeType: string;
        name: string;
    }>;
    /**
     * Delete a file from Google Drive
     */
    deleteFile(fileId: string): Promise<void>;
    /**
     * Rename a file in Google Drive
     */
    renameFile(fileId: string, newName: string): Promise<void>;
    /**
     * List all files in the app data folder (excludes storage.json)
     */
    listFiles(): Promise<Array<{
        id: string;
        name: string;
        mimeType: string;
        size: string;
    }>>;
    /**
     * Get URL for a file. appDataFolder files cannot be shared publicly,
     * so we return empty string - frontend must use download API to get blob URL.
     */
    getFileUrl(_fileId: string): Promise<string>;
    /**
     * Get user's Drive storage quota (limit and usage in bytes).
     * Returns null if about.get is not allowed (e.g. scope restriction).
     */
    getStorageQuota(): Promise<{
        limit: number;
        usage: number;
    } | null>;
}
export declare function createDriveService(accessToken: string): GoogleDriveService;
//# sourceMappingURL=googleDrive.d.ts.map
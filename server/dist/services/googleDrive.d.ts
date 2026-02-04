import type { StorageData } from '../types.js';
export declare class GoogleDriveService {
    private drive;
    private folderId;
    constructor(accessToken: string);
    /**
     * Get or create the app folder in Google Drive
     */
    getOrCreateAppFolder(): Promise<string>;
    /**
     * Find a file by name in the app folder
     */
    findFileByName(fileName: string): Promise<string | null>;
    /**
     * Load storage data from Google Drive
     */
    loadStorageData(): Promise<StorageData | null>;
    /**
     * Save storage data to Google Drive
     */
    saveStorageData(data: StorageData): Promise<void>;
    /**
     * Upload a file (PDF, image, etc.) to Google Drive
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
     * List all files in the app folder
     */
    listFiles(): Promise<Array<{
        id: string;
        name: string;
        mimeType: string;
        size: string;
    }>>;
    /**
     * Get shareable link for a file
     */
    getFileUrl(fileId: string): Promise<string>;
}
export declare function createDriveService(accessToken: string): GoogleDriveService;
//# sourceMappingURL=googleDrive.d.ts.map
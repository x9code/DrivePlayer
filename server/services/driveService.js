/**
 * Drive Service
 * Abstracts Google Drive API interactions
 * Handles range downloads, file metadata, and streaming
 */

const { Readable } = require('stream');

class DriveService {
    constructor(driveClient) {
        this.driveClient = driveClient;
    }

    /**
     * Get file metadata from Google Drive
     * @param {string} fileId - Google Drive file ID
     * @returns {Promise<{name: string, size: number, mimeType: string}>}
     */
    async getFileMetadata(fileId) {
        try {
            const response = await this.driveClient.files.get({
                fileId: fileId,
                fields: 'name, size, mimeType'
            });

            return {
                name: response.data.name,
                size: parseInt(response.data.size),
                mimeType: response.data.mimeType
            };
        } catch (error) {
            console.error(`[Drive] Error fetching metadata for ${fileId}:`, error.message);
            throw error;
        }
    }

    /**
     * Download a specific byte range from Google Drive
     * @param {string} fileId - Google Drive file ID
     * @param {number} start - Start byte (inclusive)
     * @param {number} end - End byte (inclusive)
     * @returns {Promise<Buffer>} Downloaded data
     */
    async downloadRange(fileId, start, end) {
        try {
            const response = await this.driveClient.files.get(
                { fileId: fileId, alt: 'media' },
                {
                    responseType: 'stream',
                    headers: { 'Range': `bytes=${start}-${end}` }
                }
            );

            // Convert stream to buffer
            const chunks = [];
            for await (const chunk of response.data) {
                chunks.push(chunk);
            }

            return Buffer.concat(chunks);
        } catch (error) {
            console.error(`[Drive] Error downloading range ${start}-${end} for ${fileId}:`, error.message);
            throw error;
        }
    }

    /**
     * Download multiple byte ranges and combine them
     * Useful for reading both header and footer of audio files
     * @param {string} fileId - Google Drive file ID
     * @param {Array<{start: number, end: number}>} ranges - Array of byte ranges
     * @returns {Promise<Buffer>} Combined buffer
     */
    async downloadMultipleRanges(fileId, ranges) {
        try {
            const downloads = ranges.map(range =>
                this.downloadRange(fileId, range.start, range.end)
            );

            const buffers = await Promise.all(downloads);
            return Buffer.concat(buffers);
        } catch (error) {
            console.error(`[Drive] Error downloading multiple ranges for ${fileId}:`, error.message);
            throw error;
        }
    }

    /**
     * Download enough data to parse full metadata
     * Downloads both header (1MB) and footer (128KB) for comprehensive tag extraction
     * @param {string} fileId - Google Drive file ID
     * @param {number} fileSize - Total file size in bytes
     * @returns {Promise<{stream: Readable, size: number}>} Stream with combined data
     */
    async downloadMetadataRanges(fileId, fileSize) {
        try {
            // Download first 1MB to cover large ID3v2 tags with embedded artwork
            const downloadSize = Math.min(1048576, fileSize); // 1MB or file size

            console.log(`[Drive] Downloading first ${downloadSize} bytes for metadata parsing`);

            const buffer = await this.downloadRange(fileId, 0, downloadSize - 1);

            console.log(`[Drive] Downloaded ${buffer.length} bytes successfully`);

            // Create a proper stream from buffer using PassThrough
            const { PassThrough } = require('stream');
            const stream = new PassThrough();
            stream.end(buffer);

            return {
                stream: stream,
                size: buffer.length
            };
        } catch (error) {
            console.error(`[Drive] Error downloading metadata for ${fileId}:`, error.message);
            console.error(`[Drive] Full error:`, error);

            // Fallback: try smaller range
            console.log(`[Drive] Falling back to 512KB download`);
            try {
                const headerSize = Math.min(524288, fileSize); // 512KB
                const headerBuffer = await this.downloadRange(fileId, 0, headerSize - 1);

                const { PassThrough } = require('stream');
                const stream = new PassThrough();
                stream.end(headerBuffer);

                return {
                    stream: stream,
                    size: headerBuffer.length
                };
            } catch (fallbackError) {
                console.error(`[Drive] Fallback also failed:`, fallbackError.message);
                throw error; // Throw original error
            }
        }
    }

    /**
     * Stream file for playback
     * @param {string} fileId - Google Drive file ID
     * @param {string|null} range - Optional range header (e.g., "bytes=0-1023")
     * @returns {Promise<Stream>} File stream
     */
    async streamFile(fileId, range = null) {
        try {
            const options = {
                responseType: 'stream'
            };

            if (range) {
                options.headers = { 'Range': range };
            }

            const response = await this.driveClient.files.get(
                { fileId: fileId, alt: 'media' },
                options
            );

            return response.data;
        } catch (error) {
            console.error(`[Drive] Error streaming file ${fileId}:`, error.message);
            throw error;
        }
    }

    /**
     * Check if Drive client is authenticated
     * @returns {boolean}
     */
    isAuthenticated() {
        return this.driveClient !== null;
    }
    /**
     * Recursively fetch all audio files from a folder and its subfolders
     * @param {string} folderId - The folder ID to start from
     * @param {number} maxDepth - Maximum recursion depth (default 5)
     * @param {number} maxFiles - Maximum total files to fetch (default 500)
     * @returns {Promise<Array>} List of file objects
     */
    async getFilesRecursive(folderId, maxDepth = 5, maxFiles = 500) {
        let allFiles = [];

        const fetchLevel = async (currentFolderId, currentDepth) => {
            if (currentDepth > maxDepth || allFiles.length >= maxFiles) return;

            try {
                // Fetch files and folders in current directory
                const res = await this.driveClient.files.list({
                    q: `'${currentFolderId}' in parents and (mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'audio/' or fileExtension = 'mp3' or fileExtension = 'm4a' or fileExtension = 'opus' or fileExtension = 'flac') and trashed = false`,
                    fields: 'files(id, name, mimeType, size, thumbnailLink)',
                    orderBy: 'folder, name' // Folders first
                });

                const items = res.data.files || [];

                // Separate files and folders
                const folders = items.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
                const files = items.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

                // Add files to result
                allFiles.push(...files);

                // Recurse into folders (parallel)
                if (folders.length > 0 && allFiles.length < maxFiles) {
                    await Promise.all(folders.map(folder => fetchLevel(folder.id, currentDepth + 1)));
                }

            } catch (error) {
                console.error(`[Drive] Error scanning folder ${currentFolderId}:`, error.message);
                // Continue scanning other folders even if one fails
            }
        };

        await fetchLevel(folderId, 0);
        return allFiles;
    }
}

module.exports = DriveService;

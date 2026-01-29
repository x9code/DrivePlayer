const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: '*', // Allow Vercel/Render/Localhost
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Range']
}));
app.use(express.json());

// Google Drive Auth Setup
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
let driveClient = null;

async function authenticateDrive() {
    try {
        // 1. Check if the environment variable contains JSON content directly (Render/Vercel)
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GOOGLE_APPLICATION_CREDENTIALS.trim().startsWith('{')) {
            const credsPath = path.join(__dirname, 'google-credentials.json');
            fs.writeFileSync(credsPath, process.env.GOOGLE_APPLICATION_CREDENTIALS);
            process.env.GOOGLE_APPLICATION_CREDENTIALS = credsPath;
            console.log('Detected JSON credentials, wrote to file:', credsPath);
        }

        // 2. Now use the file path (either original path or our newly created temp file)
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
            const auth = new google.auth.GoogleAuth({
                keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
                scopes: SCOPES,
            });
            driveClient = google.drive({ version: 'v3', auth });
            console.log('Authenticated with Service Account');
        } else {
            console.log('No credentials found. Please set GOOGLE_APPLICATION_CREDENTIALS in .env');
        }
    } catch (error) {
        console.error('Auth Error:', error);
    }
}

authenticateDrive();

// Caches
const metadataCache = new Map();
// Ensure cache directory exists
const CACHE_DIR = path.join(__dirname, 'cache');
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR);
}

app.get('/', (req, res) => {
    res.send('DrivePlayer Server Running');
});

// API: Browsing Files (Folders and Songs)
app.get('/api/files', async (req, res) => {
    if (!driveClient) return res.status(500).json({ error: 'Drive not authenticated' });

    let targetFolderId = req.query.folderId;

    try {
        if (!targetFolderId) {
            const folderRes = await driveClient.files.list({
                q: "name = 'music' and mimeType = 'application/vnd.google-apps.folder'",
                fields: 'files(id, name)',
            });
            if (!folderRes.data.files.length) return res.status(404).json({ error: 'Music folder not found' });
            targetFolderId = folderRes.data.files[0].id;
        }

        console.log(`Browsing folder: ${targetFolderId}`);

        const filesRes = await driveClient.files.list({
            q: `'${targetFolderId}' in parents and (mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'audio/' or fileExtension = 'mp3' or fileExtension = 'm4a' or fileExtension = 'opus' or fileExtension = 'flac')`,
            fields: 'files(id, name, mimeType, size, thumbnailLink, createdTime)',
            orderBy: 'folder, name'
        });

        // Cache metadata
        if (filesRes.data.files) {
            filesRes.data.files.forEach(file => {
                if (file.mimeType !== 'application/vnd.google-apps.folder') {
                    metadataCache.set(file.id, {
                        size: file.size,
                        mimeType: file.mimeType,
                        name: file.name,
                        createdTime: file.createdTime
                    });
                }
            });
        }

        res.json({ files: filesRes.data.files || [], folderId: targetFolderId });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// API: Search Files
app.get('/api/search', async (req, res) => {
    if (!driveClient) return res.status(500).json({ error: 'Drive not authenticated' });

    const query = req.query.q;
    if (!query) return res.json([]);

    try {
        console.log(`Searching for: ${query}`);
        const filesRes = await driveClient.files.list({
            q: `name contains '${query}' and (mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'audio/' or fileExtension = 'mp3' or fileExtension = 'm4a' or fileExtension = 'opus' or fileExtension = 'flac') and trashed = false`,
            fields: 'files(id, name, mimeType, size, thumbnailLink, createdTime)',
            pageSize: 50
        });

        // Cache metadata for results
        if (filesRes.data.files) {
            filesRes.data.files.forEach(file => {
                if (file.mimeType !== 'application/vnd.google-apps.folder') {
                    metadataCache.set(file.id, {
                        size: file.size,
                        mimeType: file.mimeType,
                        name: file.name
                    });
                }
            });
        }

        res.json(filesRes.data.files || []);
    } catch (error) {
        console.error("Search error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Backward compatibility (existing)
app.get('/api/songs', async (req, res) => {
    res.redirect('/api/files');
});

// Concurrency Limiter
class Queue {
    constructor(concurrency) {
        this.concurrency = concurrency;
        this.running = 0;
        this.queue = [];
    }

    add(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
            this.next();
        });
    }

    next() {
        if (this.running >= this.concurrency || this.queue.length === 0) return;

        const { fn, resolve, reject } = this.queue.shift();
        this.running++;

        fn().then(resolve).catch(reject).finally(() => {
            this.running--;
            this.next();
        });
    }
}

// Limit metadata extraction to 2 concurrent requests to prevent choking the network/CPU
const metadataQueue = new Queue(2);

// Helper: Get or Fetch Metadata
async function getAudioMetadata(fileId) {
    // Check in-memory metadata cache for ID3 tags
    if (metadataCache.has(fileId) && metadataCache.get(fileId).hasTags) {
        return metadataCache.get(fileId);
    }

    // Need to fetch and parse
    if (!driveClient) throw new Error('Drive not authenticated');

    // Wrap the heavy lifting in the queue
    return metadataQueue.add(async () => {
        // Double check cache inside queue in case it was populated while waiting
        if (metadataCache.has(fileId) && metadataCache.get(fileId).hasTags) {
            return metadataCache.get(fileId);
        }

        try {
            let mimeType, fileSize;
            if (metadataCache.has(fileId)) {
                const cached = metadataCache.get(fileId);
                mimeType = cached.mimeType;
                fileSize = cached.size;
            } else {
                const metadataRes = await driveClient.files.get({ fileId, fields: 'mimeType, size' });
                mimeType = metadataRes.data.mimeType;
                fileSize = metadataRes.data.size;
            }

            const response = await driveClient.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream' }
            );

            const { parseStream } = await import('music-metadata');
            const metadata = await parseStream(response.data, { mimeType: mimeType }, { skipPostHeaders: true });

            console.log(`[Metadata] Parsed: ${fileId} | Size: ${fileSize} | Type: ${mimeType}`);

            const tags = {
                // Spread existing first so we overwrite with fresh data
                ...(metadataCache.get(fileId) || {}),
                title: metadata.common.title || null,
                artist: metadata.common.artist || null,
                album: metadata.common.album || null,
                hasTags: true,
                mimeType: mimeType,
                size: fileSize,
            };

            // Cache Tags in Memory
            metadataCache.set(fileId, tags);

            // Handle Picture (Disk Cache)
            const picture = metadata.common.picture && metadata.common.picture[0];
            const cachePath = path.join(CACHE_DIR, `${fileId}`);
            if (picture) {
                fs.writeFileSync(cachePath, picture.data);
                tags.pictureFormat = picture.format;
            }

            return tags;
        } catch (error) {
            console.error(`Metadata error for ${fileId}:`, error.message);
            throw error;
        }
    });
}

// API: Get Metadata (Title, Artist)
app.get('/api/metadata/:fileId', async (req, res) => {
    try {
        const tags = await getAudioMetadata(req.params.fileId);
        res.json({
            title: tags.title,
            artist: tags.artist,
            album: tags.album
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch metadata' });
    }
});

// API: Get Thumbnail
app.get('/api/thumbnail/:fileId', async (req, res) => {
    const fileId = req.params.fileId;
    const cachePath = path.join(CACHE_DIR, `${fileId}`);

    // 1. Check Disk Cache
    if (fs.existsSync(cachePath)) {
        return res.sendFile(cachePath);
    }

    // 2. Parse if not cached (this will populate disk cache)
    try {
        await getAudioMetadata(fileId);

        // Re-check disk cache
        if (fs.existsSync(cachePath)) {
            return res.sendFile(cachePath);
        } else {
            return res.status(404).send('No picture found');
        }
    } catch (error) {
        res.status(500).send('Error');
    }
});

// API: Stream Song
app.get('/api/stream/:fileId', async (req, res) => {
    if (!driveClient) return res.status(500).json({ error: 'Drive not authenticated' });

    const fileId = req.params.fileId;
    const range = req.headers.range;

    console.log(`[Stream] Request: ${fileId} | Range: ${range}`);

    try {
        let fileSize, mimeType;

        // Robust check: Cache must have size
        if (metadataCache.has(fileId) && metadataCache.get(fileId).size) {
            const cached = metadataCache.get(fileId);
            fileSize = parseInt(cached.size);
            mimeType = cached.mimeType;
            console.log(`[Stream] Cache hit: Size=${fileSize}`);
        } else {
            console.log(`[Stream] Cache miss for size. Fetching...`);
            const fileMetadata = await driveClient.files.get({
                fileId: fileId,
                fields: 'size, mimeType'
            });
            fileSize = parseInt(fileMetadata.data.size);
            mimeType = fileMetadata.data.mimeType;

            // Merge carefully
            const existing = metadataCache.get(fileId) || {};
            metadataCache.set(fileId, { ...existing, size: fileSize, mimeType });
            console.log(`[Stream] Fetched: Size=${fileSize}`);
        }

        // MIME Type Normalization for Streaming
        if (mimeType === 'audio/x-m4a') mimeType = 'audio/mp4';
        if (mimeType === 'audio/x-flac') mimeType = 'audio/flac';
        if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') mimeType = 'audio/wav';

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;

            console.log(`[Stream] Streaming bytes ${start}-${end}/${fileSize} (${chunksize} bytes)`);

            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': mimeType,
            };
            res.writeHead(206, head);

            const driveStream = await driveClient.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream', headers: { 'Range': `bytes=${start}-${end}` } }
            );

            driveStream.data
                .on('end', () => console.log(`[Stream] End: ${fileId}`))
                .on('error', (err) => {
                    console.error(`[Stream] Error: ${fileId}`, err);
                    // Ensure we don't crash the server on stream error
                    if (!res.headersSent) res.status(500).end();
                })
                .pipe(res);
        } else {
            console.log(`[Stream] Full file: ${fileSize}`);
            const head = {
                'Content-Length': fileSize,
                'Content-Type': mimeType,
            };
            res.writeHead(200, head);

            const driveStream = await driveClient.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream' }
            );
            driveStream.data
                .on('end', () => console.log(`[Stream] End: ${fileId}`))
                .on('error', (err) => {
                    console.error(`[Stream] Error: ${fileId}`, err);
                    if (!res.headersSent) res.status(500).end();
                })
                .pipe(res);
        }
    } catch (error) {
        console.error('[Stream] Fatal Error:', error.message);
        if (!res.headersSent) res.status(500).send('Error streaming file');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const express = require('express');
const cors = require('cors');
const { YtDlp } = require('ytdlp-nodejs');
const ffmpegPath = require('ffmpeg-static');
const app = express();
const ytdlp = new YtDlp({ ffmpegPath });

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve frontend

app.get('/api/info', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: "⚠️ No URL provided. Please paste a link." });
    }

    try {
        const info = await ytdlp.getInfoAsync(url);
        
        // Debug: log all available keys to understand the object shape
        console.log("All info keys:", Object.keys(info));
        console.log("Duration fields:", { duration: info.duration, duration_string: info.duration_string });
        console.log("Thumbnail fields:", { thumbnail: info.thumbnail, thumbnails: info.thumbnails ? info.thumbnails.length : 0 });

        // --- Extract thumbnail ---
        let thumbnail = info.thumbnail || null;
        if (!thumbnail && info.thumbnails && info.thumbnails.length > 0) {
            // Pick the last (usually highest quality) thumbnail
            const lastThumb = info.thumbnails[info.thumbnails.length - 1];
            thumbnail = typeof lastThumb === 'string' ? lastThumb : lastThumb.url || lastThumb.src || null;
        }

        // --- Extract duration ---
        let duration = info.duration_string || null;
        if (!duration && info.duration) {
            // info.duration is usually in seconds, format it
            const totalSec = Math.round(Number(info.duration));
            if (!isNaN(totalSec)) {
                const hrs = Math.floor(totalSec / 3600);
                const mins = Math.floor((totalSec % 3600) / 60);
                const secs = totalSec % 60;
                duration = hrs > 0
                    ? `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
                    : `${mins}:${String(secs).padStart(2, '0')}`;
            }
        }

        console.log("Resolved →", { title: info.title, thumbnail, duration });

        res.json({
            title: info.title,
            thumbnail: thumbnail,
            downloadUrl: info.url,
            duration: duration
        });
    } catch (err) {
        console.error("Info fetch error:", err.message);
        const errMsg = (err.message || '').toLowerCase();

        if (errMsg.includes('private') || errMsg.includes('login') || errMsg.includes('authentication')) {
            return res.status(403).json({ error: "🔒 This content is private or requires login. Only public videos can be downloaded." });
        }
        if (errMsg.includes('not found') || errMsg.includes('404') || errMsg.includes('does not exist') || errMsg.includes('unavailable')) {
            return res.status(404).json({ error: "🔍 Video not found. It may have been deleted or the link is incorrect." });
        }
        if (errMsg.includes('unsupported') || errMsg.includes('no video')) {
            return res.status(400).json({ error: "🚫 This URL doesn't contain downloadable video content." });
        }
        if (errMsg.includes('geo') || errMsg.includes('country') || errMsg.includes('region')) {
            return res.status(403).json({ error: "🌍 This video is not available in your region." });
        }
        if (errMsg.includes('age') || errMsg.includes('sign in')) {
            return res.status(403).json({ error: "🔞 This content is age-restricted and cannot be downloaded." });
        }

        res.status(500).json({ error: "❌ Could not fetch this video. Please double-check the link and try again." });
    }
});

// Proxy endpoint for images to bypass CORS/Referer issues
app.get('/api/proxy-image', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send('URL is required');

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
        
        const contentType = response.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);
        
        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
    } catch (err) {
        console.error("Proxy error:", err);
        res.status(500).send("Could not fetch image.");
    }
});

app.get('/api/download', async (req, res) => {
    const { url, type } = req.query;
    const format = type || 'video'; // video, mp3, wav

    if (!url) return res.status(400).send('URL is required');

    try {
        console.log(`Starting download for ${url} as ${format}`);
        const info = await ytdlp.getInfoAsync(url);
        const title = (info.title || 'video').replace(/[^a-zA-Z0-9 ]/g, ""); // Sanitize filename
        
        let fileExt = 'mp4';
        let contentType = 'video/mp4';

        if (format === 'mp3') {
            fileExt = 'mp3';
            contentType = 'audio/mpeg';
        } else if (format === 'wav') {
            fileExt = 'wav';
            contentType = 'audio/wav';
        }

        res.setHeader('Content-Disposition', `attachment; filename="${title}.${fileExt}"`);
        res.setHeader('Content-Type', contentType);

        let streamBuilder = ytdlp.stream(url);

        if (format === 'mp3') {
            streamBuilder = streamBuilder.filter('audioonly').type('mp3');
        } else if (format === 'wav') {
            streamBuilder = streamBuilder.filter('audioonly').type('wav');
        } else {
            // Default video - simplified to avoid pipe issues with merging
            // forcing 'best' format which is usually a single file or handled better
            streamBuilder = streamBuilder.format('best'); 
        }

        streamBuilder.pipe(res).then(() => {
            console.log("Download completed");
        }).catch((err) => {
             console.error('Stream error:', err);
             // Cannot send error response if headers sent
        });

    } catch (err) {
        console.error("Download error:", err);
        if (!res.headersSent) res.status(500).send("Extraction failed.");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ReelVault running on http://localhost:${PORT}`));

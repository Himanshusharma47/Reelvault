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
    try {
        const info = await ytdlp.getInfoAsync(url);
        console.log("Video Info Retrieved:", { title: info.title, thumbnail: info.thumbnail, thumbnails: info.thumbnails ? info.thumbnails.length : 0 });
        res.json({
            title: info.title,
            thumbnail: info.thumbnail,
            downloadUrl: info.url, // Direct link
            duration: info.duration_string
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not fetch video. Check link.", details: err.message });
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

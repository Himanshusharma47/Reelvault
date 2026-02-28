// ========== Supported Platforms ==========
const SUPPORTED_PATTERNS = [
    { name: 'Instagram', pattern: /^https?:\/\/(www\.)?instagram\.com\/(reel|reels|p|tv)\//i },
    { name: 'TikTok',    pattern: /^https?:\/\/(www\.|vm\.|vt\.)?tiktok\.com\//i },
    { name: 'YouTube',   pattern: /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i },
    { name: 'Facebook',  pattern: /^https?:\/\/(www\.|m\.)?facebook\.com\//i },
    { name: 'Twitter/X', pattern: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\//i },
];

// ========== URL Validation ==========
function validateUrl(url) {
    // Empty check
    if (!url) {
        return { valid: false, message: "⚠️ Please paste a video link first." };
    }

    // Basic URL format check
    try {
        new URL(url);
    } catch {
        return { valid: false, message: "❌ That doesn't look like a valid URL. Make sure it starts with https://" };
    }

    // Must be http/https
    if (!/^https?:\/\//i.test(url)) {
        return { valid: false, message: "❌ Invalid URL format. Links should start with https://" };
    }

    // Check for supported platforms
    const match = SUPPORTED_PATTERNS.find(p => p.pattern.test(url));
    if (!match) {
        return {
            valid: false,
            message: "🚫 Unsupported link. We currently support Instagram, TikTok, YouTube, Facebook, and Twitter/X."
        };
    }

    // Extra check: URL too short (likely incomplete copy)
    if (url.length < 20) {
        return { valid: false, message: "⚠️ That link looks incomplete. Please copy the full URL from your browser." };
    }

    return { valid: true, platform: match.name };
}

// ========== Main Download Function ==========
async function getDownload() {
    const urlInput = document.getElementById('urlInput');
    const resultDiv = document.getElementById('result');
    const loadingDiv = document.getElementById('loading');
    const downloadBtn = document.getElementById('downloadBtn');

    const url = urlInput.value.trim();

    // Client-side validation
    const validation = validateUrl(url);
    if (!validation.valid) {
        showError(validation.message);
        shakeInput();
        return;
    }

    // Reset UI
    resultDiv.style.display = 'none';
    hideError();
    loadingDiv.style.display = 'block';
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Fetching...';

    try {
        const response = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
        const data = await response.json();

        if (response.ok) {
            displayResult(data);
        } else {
            // Use the specific error from server
            showError(data.error || "❌ Something went wrong. Please try again.");
        }
    } catch (err) {
        showError("🌐 Network error. Please check your internet connection and try again.");
    } finally {
        loadingDiv.style.display = 'none';
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'Snag Video';
    }
}

// ========== Display Result ==========
function displayResult(data) {
    const resultDiv = document.getElementById('result');
    document.getElementById('videoTitle').textContent = data.title || "Unknown Title";

    if (data.thumbnail) {
        document.getElementById('videoThumbnail').src = `/api/proxy-image?url=${encodeURIComponent(data.thumbnail)}`;
    } else {
        document.getElementById('videoThumbnail').src = "assets/placeholder.png";
    }

    document.getElementById('durationVal').textContent = data.duration || "N/A";

    const downloadLink = document.getElementById('downloadLink');
    downloadLink.dataset.originalUrl = data.downloadUrl;
    downloadLink.dataset.serverDownload = "true";

    updateDownloadLink();
    resultDiv.style.display = 'flex';
}

// ========== Format Selection ==========
let currentFormat = 'video';

function selectFormat(format) {
    currentFormat = format;
    document.querySelectorAll('.format-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.format === format);
    });
    updateDownloadLink();
}

function updateDownloadLink() {
    const downloadLink = document.getElementById('downloadLink');
    const urlInput = document.getElementById('urlInput');
    const url = urlInput.value.trim();

    if (currentFormat === 'video') {
        downloadLink.href = `/api/download?url=${encodeURIComponent(url)}&type=video`;
    } else {
        downloadLink.href = `/api/download?url=${encodeURIComponent(url)}&type=${currentFormat}`;
    }
}

// ========== Error Handling UI ==========
function showError(msg) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.innerHTML = `
        <div class="error-content">
            <span class="error-text">${msg}</span>
            <button class="error-close" onclick="hideError()" aria-label="Close">&times;</button>
        </div>
    `;
    errorDiv.style.display = 'block';
    errorDiv.classList.remove('error-hide');
    errorDiv.classList.add('error-show');

    // Auto-dismiss after 6 seconds
    clearTimeout(errorDiv._timeout);
    errorDiv._timeout = setTimeout(() => hideError(), 6000);
}

function hideError() {
    const errorDiv = document.getElementById('error-message');
    errorDiv.classList.remove('error-show');
    errorDiv.classList.add('error-hide');
    setTimeout(() => {
        errorDiv.style.display = 'none';
        errorDiv.classList.remove('error-hide');
    }, 300);
}

function shakeInput() {
    const input = document.getElementById('urlInput');
    input.classList.add('shake');
    setTimeout(() => input.classList.remove('shake'), 500);
}

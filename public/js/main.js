async function getDownload() {
    const urlInput = document.getElementById('urlInput');
    const resultDiv = document.getElementById('result');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error-message');
    const downloadBtn = document.getElementById('downloadBtn');

    const url = urlInput.value.trim();

    if (!url) {
        showError("Please enter a valid URL.");
        return;
    }

    // Reset UI
    resultDiv.style.display = 'none';
    errorDiv.style.display = 'none';
    loadingDiv.style.display = 'block';
    downloadBtn.disabled = true;

    try {
        const response = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
        const data = await response.json();

        if (response.ok) {
            displayResult(data);
        } else {
            showError(data.error || "Something went wrong.");
        }
    } catch (err) {
        showError("Network error. Please try again.");
    } finally {
        loadingDiv.style.display = 'none';
        downloadBtn.disabled = false;
    }
}

function displayResult(data) {
    const resultDiv = document.getElementById('result');
    document.getElementById('videoTitle').textContent = data.title || "Unknown Title";
    
    // Use proxy for thumbnail to avoid CORS/dead links
    if (data.thumbnail) {
        document.getElementById('videoThumbnail').src = `/api/proxy-image?url=${encodeURIComponent(data.thumbnail)}`;
    } else {
        document.getElementById('videoThumbnail').src = "assets/placeholder.png";
    }

    document.getElementById('durationVal').textContent = data.duration || "N/A";
    
    // Direct download or link to file
    const downloadLink = document.getElementById('downloadLink');
    // Store original URL for format switching
    downloadLink.dataset.originalUrl = data.downloadUrl; 
    downloadLink.dataset.serverDownload = "true"; // Mark to use server endpoint
    
    updateDownloadLink();

    resultDiv.style.display = 'flex';
}

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
         // Use server streaming for video too to ensure consistency, 
         // OR use direct link if provided (but server ensures download headers)
         // Let's use our new endpoint for everything to be consistent
        downloadLink.href = `/api/download?url=${encodeURIComponent(url)}&type=video`;
    } else {
        downloadLink.href = `/api/download?url=${encodeURIComponent(url)}&type=${currentFormat}`;
    }
}

function showError(msg) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
}

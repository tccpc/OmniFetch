console.log("OmniFetch content script loaded.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanFiles') {
    const files = scanPageForFiles(request.extensions);
    sendResponse({ files: files });
  }
});

function scanPageForFiles(customExtensions) {
  const extensions = customExtensions || [
    // Documents
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv',
    // Archives
    '.zip', '.rar', '.7z', '.tar', '.gz',
    // Images
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff',
    // Video
    '.mp4', '.webm', '.mkv', '.avi', '.mov', '.flv', '.wmv',
    // Audio
    '.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'
  ];
  // Scan anchor tags
  const links = Array.from(document.querySelectorAll('a'));
  // Scan media tags
  const mediaElements = Array.from(document.querySelectorAll('img, video, audio, source'));

  const files = [];
  const seenUrls = new Set();

  // Helper to process URL
  const processUrl = (url, element, type) => {
    if (!url) return;
    
    // Resolve relative URLs
    let urlObj;
    try {
      urlObj = new URL(url, document.baseURI);
    } catch (e) {
      return;
    }

    const href = urlObj.href;
    const pathname = urlObj.pathname.toLowerCase();
    const hrefLower = href.toLowerCase();
    
    const isFile = extensions.some(ext => hrefLower.includes(ext));

    if (isFile && !seenUrls.has(href)) {
      seenUrls.add(href);
      
      // 1. Calculate Original Filename (from URL)
      let originalName = decodeURIComponent(pathname.split('/').pop());
      
      // 2. Calculate Detected Name (from text/attributes)
      let detectedName = '';
      if (type === 'anchor') {
        detectedName = element.innerText.trim();
      } else if (element.alt) {
        detectedName = element.alt.trim();
      } else if (element.title) {
        detectedName = element.title.trim();
      }

      // Fallback for detected name if empty
      if (!detectedName) {
        detectedName = originalName;
      } else {
        // Ensure extension is present in detected name
        const ext = pathname.split('.').pop();
        if (!detectedName.toLowerCase().endsWith('.' + ext)) {
          detectedName += '.' + ext;
        }
      }

      // Sanitize filenames
      originalName = originalName.replace(/[<>:"/\\|?*]/g, '_');
      detectedName = detectedName.replace(/[<>:"/\\|?*]/g, '_');

      files.push({
        url: href,
        name: detectedName, // Default to detected name for backward compatibility/initial render
        originalName: originalName,
        detectedName: detectedName
      });
    }
  };

  links.forEach(link => processUrl(link.href, link, 'anchor'));
  mediaElements.forEach(el => {
    const src = el.currentSrc || el.src;
    processUrl(src, el, 'media');
    
    // Also check for srcset in images if needed, but usually src is enough for downloaders or currentSrc
    // If it's a video/audio with sources, the 'source' tag query handles children.
  });

  return files;
}

console.log("PDF Batch Downloader content script loaded.");

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
      
      // Determine filename
      let name = '';
      if (type === 'anchor') {
        name = element.innerText.trim();
      } else if (element.alt) {
        name = element.alt.trim();
      } else if (element.title) {
        name = element.title.trim();
      }

      if (!name) {
        name = decodeURIComponent(pathname.split('/').pop());
      } else {
        // Ensure extension is present in name
        const ext = pathname.split('.').pop();
        if (!name.toLowerCase().endsWith('.' + ext)) {
          name += '.' + ext;
        }
      }

      // Sanitize filename
      name = name.replace(/[<>:"/\\|?*]/g, '_');

      files.push({
        url: href,
        name: name
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

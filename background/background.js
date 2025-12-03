

// Context menu creation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "scanPage",
    title: "Batch Download All Files",
    contexts: ["all"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "scanPage") {
    // Send message to content script to scan files
    chrome.tabs.sendMessage(tab.id, { action: 'scanFiles' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn("Could not communicate with content script:", chrome.runtime.lastError.message);
        // Try injecting if failed (e.g. on fresh install before reload)
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content.js']
        }, () => {
           setTimeout(() => {
             chrome.tabs.sendMessage(tab.id, { action: 'scanFiles' }, (res) => {
               handleScanResult(res, tab);
             });
           }, 100);
        });
        return;
      }
      handleScanResult(response, tab);
    });
  }
});

function handleScanResult(response, tab) {
  if (response && response.files && response.files.length > 0) {
    const files = response.files;
    
    // Get settings
    chrome.storage.local.get(['folderName', 'delayTime'], (result) => {
      let folder = result.folderName;
      const delay = parseInt(result.delayTime) || 10;

      if (!folder) {
        const url = new URL(tab.url);
        folder = url.hostname;
      }

      console.log(`Starting download of ${files.length} files to folder '${folder}' with delay ${delay}ms`);
      downloadFiles(files, folder, delay);
    });
  } else {
    console.log("No files found to download.");
  }
}

async function downloadFiles(files, folder, delay) {
  let index = 0;

  function downloadNext() {
    if (index >= files.length) return;

    const file = files[index];
    const filename = `${folder}/${file.name}`;

    chrome.downloads.download({
      url: file.url,
      filename: filename,
      conflictAction: 'uniquify'
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error(`Download failed for ${file.name}: ${chrome.runtime.lastError.message}`);
      } else {
        console.log(`Started download for ${file.name} (ID: ${downloadId})`);
      }
      
      index++;
      if (index < files.length) {
        setTimeout(downloadNext, delay);
      }
    });
  }

  downloadNext();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadFiles') {
    downloadFiles(request.files, request.folder, request.delay);
  } else if (request.action === 'getFileSizes') {
    fetchFileSizes(request.urls).then(sizes => {
      sendResponse({ sizes: sizes });
    });
    return true; // Keep channel open for async response
  }
});

async function fetchFileSizes(urls) {
  const sizes = {};
  const promises = urls.map(async (url) => {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const length = response.headers.get('Content-Length');
      if (length) {
        sizes[url] = parseInt(length, 10);
      }
    } catch (e) {
      console.error(`Failed to fetch size for ${url}:`, e);
    }
  });
  
  await Promise.all(promises);
  return sizes;
}

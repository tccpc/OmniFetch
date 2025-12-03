

const EXTENSIONS = {
  docs: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'],
  archives: ['.zip', '.rar', '.7z', '.tar', '.gz'],
  imgs: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff'],
  video: ['.mp4', '.webm', '.mkv', '.avi', '.mov', '.flv', '.wmv'],
  audio: ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac']
};

const CATEGORY_LABELS = {
  docs: '文档',
  imgs: '图片',
  video: '视频',
  audio: '音频',
  archives: '压缩包'
};

const MENU_IDS = {
  root: 'omnifetch-root',
  all: 'omnifetch-all',
  docs: 'omnifetch-docs',
  imgs: 'omnifetch-imgs',
  video: 'omnifetch-video',
  audio: 'omnifetch-audio',
  archives: 'omnifetch-archives'
};

const ALL_EXTENSIONS = Object.values(EXTENSIONS).flat();

// Context menu creation
const createContextMenus = () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_IDS.root,
      title: "OmniFetch 批量下载",
      contexts: ["all"]
    });

    chrome.contextMenus.create({
      id: MENU_IDS.all,
      parentId: MENU_IDS.root,
      title: "全部类型",
      contexts: ["all"]
    });

    Object.entries(CATEGORY_LABELS).forEach(([key, label]) => {
      chrome.contextMenus.create({
        id: MENU_IDS[key],
        parentId: MENU_IDS.root,
        title: `仅${label}`,
        contexts: ["all"]
      });
    });
  });
};

chrome.runtime.onInstalled.addListener(createContextMenus);
chrome.runtime.onStartup.addListener(createContextMenus);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;

  const selectedExtensions = resolveExtensionsFromMenu(info.menuItemId);
  if (!selectedExtensions) return;

  triggerScan(tab, selectedExtensions);
});

function resolveExtensionsFromMenu(menuItemId) {
  if (menuItemId === MENU_IDS.all) {
    return ALL_EXTENSIONS;
  }
  const entry = Object.entries(MENU_IDS).find(([key, id]) => key !== 'root' && key !== 'all' && id === menuItemId);
  if (!entry) return null;
  const categoryKey = entry[0];
  return EXTENSIONS[categoryKey] ? EXTENSIONS[categoryKey] : null;
}

function triggerScan(tab, extensions) {
  chrome.tabs.sendMessage(tab.id, { action: 'scanFiles', extensions }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("Could not communicate with content script:", chrome.runtime.lastError.message);
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/content.js']
      }, () => {
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { action: 'scanFiles', extensions }, (res) => {
            handleScanResult(res, tab);
          });
        }, 100);
      });
      return;
    }
    handleScanResult(response, tab);
  });
}

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
  } else if (request.action === 'scopeSelected') {
    // 转发消息到popup(如果popup打开的话)
    chrome.runtime.sendMessage(request);
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

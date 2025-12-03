document.addEventListener('DOMContentLoaded', () => {
  const scanBtn = document.getElementById('scanBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const fileList = document.getElementById('fileList');
  const fileCount = document.getElementById('fileCount');
  const selectAll = document.getElementById('selectAll');
  const folderNameInput = document.getElementById('folderName');
  const delayTimeInput = document.getElementById('delayTime');
  
  // Filter elements
  const typeCheckboxes = document.querySelectorAll('.type-checkboxes input');

  let files = [];

  // Extension categories
  const EXTENSIONS = {
    docs: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'],
    archives: ['.zip', '.rar', '.7z', '.tar', '.gz'],
    imgs: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff'],
    video: ['.mp4', '.webm', '.mkv', '.avi', '.mov', '.flv', '.wmv'],
    audio: ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac']
  };

  // Load settings
  chrome.storage.local.get(['folderName', 'delayTime'], (result) => {
    if (result.folderName) folderNameInput.value = result.folderName;
    if (result.delayTime) delayTimeInput.value = result.delayTime;
  });

  // Save settings on change
  folderNameInput.addEventListener('change', () => {
    chrome.storage.local.set({ folderName: folderNameInput.value });
  });

  delayTimeInput.addEventListener('change', () => {
    chrome.storage.local.set({ delayTime: delayTimeInput.value });
  });

  // Scan for files
  scanBtn.addEventListener('click', async () => {
    const originalText = scanBtn.textContent;
    scanBtn.textContent = 'Scanning...';
    scanBtn.disabled = true;

    // Get selected extensions
    let selectedExtensions = [];
    typeCheckboxes.forEach(cb => {
      if (cb.checked) {
        selectedExtensions = selectedExtensions.concat(EXTENSIONS[cb.value]);
      }
    });

    if (selectedExtensions.length === 0) {
      alert("Please select at least one file type.");
      scanBtn.textContent = originalText;
      scanBtn.disabled = false;
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Default folder name to domain if empty
    if (!folderNameInput.value) {
      const url = new URL(tab.url);
      folderNameInput.value = url.hostname;
      chrome.storage.local.set({ folderName: url.hostname });
    }

    // Send message to content script
    try {
      chrome.tabs.sendMessage(tab.id, { action: 'scanFiles', extensions: selectedExtensions }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script might not be loaded (e.g. restricted page or not injected yet)
          // Fallback: Inject script dynamically if message fails? 
          // Or just alert user to refresh.
          // For now, let's try to inject if it fails, or just rely on manifest injection.
          console.warn("Could not communicate with content script:", chrome.runtime.lastError.message);
          
          // Fallback: execute script dynamically
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/content.js']
          }, () => {
             // Try sending message again after injection
             setTimeout(() => {
               chrome.tabs.sendMessage(tab.id, { action: 'scanFiles', extensions: selectedExtensions }, (res) => {
                 if (res && res.files) {
                   files = res.files;
                   renderFileList();
                   // updateCount(); // Removed as renderFileList now updates count
                 }
                 scanBtn.textContent = originalText;
                 scanBtn.disabled = false;
               });
             }, 100);
          });
          return;
        }

        if (response && response.files) {
          files = response.files;
          renderFileList();
          // updateCount(); // Removed as renderFileList now updates count
        }
        scanBtn.textContent = originalText;
        scanBtn.disabled = false;
      });
    } catch (e) {
      console.error("Error sending message:", e);
      scanBtn.textContent = originalText;
      scanBtn.disabled = false;
    }
  });

  // Render file list
  function renderFileList() {
    fileList.innerHTML = '';
    
    files.forEach((file, index) => {
      const li = document.createElement('li');
      li.className = 'file-item';
      li.innerHTML = `
        <input type="checkbox" checked data-index="${index}">
        <div class="file-info">
          <input type="text" class="file-name" value="${file.name}" data-index="${index}">
          <span class="file-url" title="${file.url}">${file.url}</span>
        </div>
        <button class="delete-btn" data-index="${index}">×</button>
      `;
      fileList.appendChild(li);
    });
    
    fileCount.textContent = `${files.length} files found`;
    downloadBtn.disabled = files.length === 0;
    
    // Add event listeners for new elements
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        files.splice(index, 1);
        renderFileList();
        // updateCount(); // Removed as renderFileList now updates count
      });
    });

    document.querySelectorAll('.file-name').forEach(input => {
      input.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        files[index].name = e.target.value;
      });
    });
  }

  // Select All toggle
  selectAll.addEventListener('change', (e) => {
    const checkboxes = fileList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = e.target.checked);
  });

  // Download logic
  downloadBtn.addEventListener('click', () => {
    const selectedFiles = [];
    const checkboxes = fileList.querySelectorAll('input[type="checkbox"]');
    
    checkboxes.forEach((cb, index) => {
      if (cb.checked) {
        selectedFiles.push(files[index]); 
      }
    });

    if (selectedFiles.length === 0) return;

    const folder = folderNameInput.value || 'download';
    const delay = parseInt(delayTimeInput.value) || 10;

    chrome.runtime.sendMessage({
      action: 'downloadFiles',
      files: selectedFiles,
      folder: folder,
      delay: delay
    });
  });

});

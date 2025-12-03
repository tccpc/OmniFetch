document.addEventListener('DOMContentLoaded', () => {
  const scanBtn = document.getElementById('scanBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const fileList = document.getElementById('fileList');
  const fileCount = document.getElementById('fileCount');
  const selectAll = document.getElementById('selectAll');
  const folderNameInput = document.getElementById('folderName');
  const delayTimeInput = document.getElementById('delayTime');
  const settingsToggle = document.getElementById('settingsToggle');
  const settingsSection = document.getElementById('settingsSection');
  const categoryDropdown = document.getElementById('categoryDropdown');
  const categoryToggle = document.getElementById('categoryToggle');
  const categoryMenu = document.getElementById('categoryMenu');
  const formatDropdown = document.getElementById('formatDropdown');
  const formatToggle = document.getElementById('formatToggle');
  const formatMenu = document.getElementById('formatMenu');
  const selectedFiltersContainer = document.getElementById('selectedFilters');
  const preFilterSection = document.getElementById('preFilterSection');
  
  // Scope selection elements
  const selectScopeBtn = document.getElementById('selectScopeBtn');
  const clearScopeBtn = document.getElementById('clearScopeBtn');
  const scopeSelector = document.getElementById('scopeSelector');
  
  // Filter elements
  const namingRadios = document.querySelectorAll('input[name="namingMethod"]');
  const pathLevelSelect = document.getElementById('pathLevel');
  const originalOptions = document.getElementById('originalOptions');

  let files = [];

  // Extension categories
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
  const FILTER_STORAGE_KEY = 'selectedFilters';
  const FILTER_CATEGORY_KEY = 'activeFilterCategory';
  const selectedFilters = Object.keys(EXTENSIONS).reduce((acc, key) => {
    acc[key] = new Set();
    return acc;
  }, {});
  let activeCategory = 'docs';

  // Load settings
  chrome.storage.local.get(['folderName', 'delayTime', 'namingMethod', 'settingsVisible', 'searchScope', 'searchScopeDisplay', 'searchScopeUrl'], async (result) => {
    if (result.folderName) folderNameInput.value = result.folderName;
    if (result.delayTime) delayTimeInput.value = result.delayTime;
    if (result.namingMethod) {
      const radio = document.querySelector(`input[name="namingMethod"][value="${result.namingMethod}"]`);
      if (radio) {
        radio.checked = true;
        if (result.namingMethod === 'original') {
          originalOptions.classList.remove('hidden');
        }
      }
    }
    if (result.pathLevel) {
      pathLevelSelect.value = result.pathLevel;
    }
    // Restore settings visibility
    if (result.settingsVisible) {
      settingsSection.classList.remove('hidden');
    }
    
    // 校验搜索范围是否适用于当前网站
    if (result.searchScopeDisplay && result.searchScope) {
      // 获取当前标签页的URL
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        const currentUrl = new URL(tab.url);
        const currentOrigin = currentUrl.origin;
        
        // 如果保存的URL与当前URL的origin相同,则恢复范围设置
        if (result.searchScopeUrl === currentOrigin) {
          scopeSelector.textContent = result.searchScopeDisplay;
        } else {
          // 不同网站,清空范围设置
          scopeSelector.textContent = '整个页面';
          chrome.storage.local.set({ 
            searchScope: null,
            searchScopeDisplay: null,
            searchScopeUrl: null
          });
        }
      }
    }
  });

  // Toggle Settings
  settingsToggle.addEventListener('click', () => {
    settingsSection.classList.toggle('hidden');
    const isVisible = !settingsSection.classList.contains('hidden');
    chrome.storage.local.set({ settingsVisible: isVisible });
  });

  // Save settings on change
  folderNameInput.addEventListener('change', () => {
    chrome.storage.local.set({ folderName: folderNameInput.value });
  });

  delayTimeInput.addEventListener('change', () => {
    chrome.storage.local.set({ delayTime: delayTimeInput.value });
  });

  // Scope selection handlers
  selectScopeBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // 发送消息到content script启动元素选择
    chrome.tabs.sendMessage(tab.id, { action: 'startElementSelection' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn("Could not start element selection:", chrome.runtime.lastError.message);
        // 尝试注入脚本
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/selector.js']
        }, () => {
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { action: 'startElementSelection' }, (res) => {
              if (chrome.runtime.lastError) {
                console.error("Failed to start element selection after injection:", chrome.runtime.lastError.message);
              }
            });
          }, 100);
        });
      }
    });
    
    // 关闭popup(用户需要在页面上选择)
    window.close();
  });

  clearScopeBtn.addEventListener('click', () => {
    chrome.storage.local.set({ 
      searchScope: null,
      searchScopeDisplay: null,
      searchScopeUrl: null  // 同时清除URL
    }, () => {
      scopeSelector.textContent = '整个页面';
    });
  });

  // 监听来自background的范围选择消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scopeSelected') {
      scopeSelector.textContent = request.display || request.selector;
    }
  });

  restoreFilters(() => {
    initCategoryMenu();
    renderFormatMenu(activeCategory);
    renderSelectedFilters();
  });
  setupDropdownInteractions();

  // Handle naming method change
  namingRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const method = e.target.value;
      chrome.storage.local.set({ namingMethod: method });
      
      if (method === 'original') {
        originalOptions.classList.remove('hidden');
      } else {
        originalOptions.classList.add('hidden');
      }

      updateFileNames();
    });
  });

  pathLevelSelect.addEventListener('change', () => {
    chrome.storage.local.set({ pathLevel: pathLevelSelect.value });
    updateFileNames();
  });

  function updateFileNames() {
    if (files.length === 0) return;

    const method = document.querySelector('input[name="namingMethod"]:checked').value;
    const level = parseInt(pathLevelSelect.value) || 0;

    files.forEach(file => {
      if (method === 'original') {
        file.name = getOriginalNameWithLevel(file.url, level);
      } else {
        file.name = file.detectedName || file.name;
      }
    });
    renderFileList();
  }

  function getOriginalNameWithLevel(url, level) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      // Decode and split path
      const parts = decodeURIComponent(pathname).split('/').filter(p => p.length > 0);
      
      if (parts.length === 0) return 'download';

      // Get the last (level + 1) parts
      const count = level + 1;
      const selectedParts = parts.slice(-count);
      
      let name = selectedParts.join('_');
      // Sanitize
      name = name.replace(/[<>:"/\\|?*]/g, '_');
      return name;
    } catch (e) {
      return 'download';
    }
  }

  // Scan for files
  scanBtn.addEventListener('click', async () => {
    const originalText = scanBtn.textContent;
    scanBtn.textContent = 'Scanning...';
    scanBtn.disabled = true;

    // Get selected extensions
    const selectedExtensions = collectSelectedExtensions();

    if (selectedExtensions.length === 0) {
      alert("请至少选择一种文件格式。");
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
                 handleScanResponse(res);
                 scanBtn.textContent = originalText;
                 scanBtn.disabled = false;
               });
             }, 100);
          });
          return;
        }

        handleScanResponse(response);
        scanBtn.textContent = originalText;
        scanBtn.disabled = false;
      });
    } catch (e) {
      console.error("Error sending message:", e);
      scanBtn.textContent = originalText;
      scanBtn.disabled = false;
    }
  });

  function handleScanResponse(response) {
    if (response && response.files) {
      files = response.files;
      
      // Apply current naming preference
      updateFileNames();

      renderFileList();
    }
  }

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

  function initCategoryMenu() {
    categoryMenu.innerHTML = '';
    Object.entries(CATEGORY_LABELS).forEach(([value, label]) => {
      const li = document.createElement('li');
      li.textContent = label;
      li.dataset.value = value;
      if (value === activeCategory) li.classList.add('active');
      li.addEventListener('click', () => selectCategory(value));
      categoryMenu.appendChild(li);
    });
    updateCategoryToggle();
  }

  function selectCategory(value) {
    activeCategory = value;
    updateCategoryToggle();
    [...categoryMenu.children].forEach(li => {
      li.classList.toggle('active', li.dataset.value === value);
    });
    renderFormatMenu(value);
    closeDropdown(categoryDropdown);
    persistFilterState();
  }

  function renderFormatMenu(category) {
    const selection = ensureSelection(category);
    formatMenu.innerHTML = '';

    const allLabel = document.createElement('label');
    allLabel.innerHTML = `<input type="checkbox" data-role="all"> 全部格式`;
    const allInput = allLabel.querySelector('input');
    allInput.checked = selection.size === EXTENSIONS[category].length;
    allLabel.addEventListener('click', (e) => e.stopPropagation());
    formatMenu.appendChild(allLabel);

    EXTENSIONS[category].forEach(ext => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="checkbox" value="${ext}"> ${ext}`;
      const input = label.querySelector('input');
      input.checked = selection.has(ext);
      label.addEventListener('click', (e) => e.stopPropagation());
      formatMenu.appendChild(label);
    });

    updateFormatToggleLabel(category);
  }

  formatMenu.addEventListener('change', (e) => {
    if (e.target.tagName !== 'INPUT') return;
    handleFormatChange(e.target);
  });

  function handleFormatChange(target) {
    const selection = ensureSelection(activeCategory);
    if (target.dataset.role === 'all') {
      if (target.checked) {
        EXTENSIONS[activeCategory].forEach(ext => selection.add(ext));
        formatMenu.querySelectorAll('input[type="checkbox"]:not([data-role="all"])').forEach(cb => cb.checked = true);
      } else {
        selection.clear();
        formatMenu.querySelectorAll('input[type="checkbox"]:not([data-role="all"])').forEach(cb => cb.checked = false);
      }
    } else {
      if (target.checked) {
        selection.add(target.value);
      } else {
        selection.delete(target.value);
      }
      const allCheckbox = formatMenu.querySelector('input[data-role="all"]');
      allCheckbox.checked = selection.size === EXTENSIONS[activeCategory].length;
    }
    selectedFilters[activeCategory] = new Set(selection);
    updateFormatToggleLabel(activeCategory);
    renderSelectedFilters();
    persistFilterState();
  }

  function ensureSelection(category) {
    if (!selectedFilters[category]) {
      selectedFilters[category] = new Set();
    }
    return selectedFilters[category];
  }

  function updateCategoryToggle() {
    categoryToggle.textContent = CATEGORY_LABELS[activeCategory];
  }

  function updateFormatToggleLabel(category) {
    const selection = ensureSelection(category);
    if (selection.size === 0) {
      formatToggle.textContent = '未选择';
      return;
    }
    if (selection.size === EXTENSIONS[category].length) {
      formatToggle.textContent = '全部格式';
      return;
    }
    const items = Array.from(selection);
    formatToggle.textContent = items.length > 2 ? `${items.slice(0, 2).join(', ')} +${items.length - 2}` : items.join(', ');
  }

  function renderSelectedFilters() {
    selectedFiltersContainer.innerHTML = '';
    const entries = Object.entries(selectedFilters).filter(([_, set]) => set.size > 0);
    if (entries.length === 0) {
      selectedFiltersContainer.innerHTML = '<span class="filter-empty">未选择筛选条件</span>';
      return;
    }
    entries.forEach(([category, set]) => {
      const pill = document.createElement('div');
      pill.className = 'filter-pill';
      const title = document.createElement('strong');
      title.textContent = CATEGORY_LABELS[category];
      const detail = document.createElement('span');
      detail.textContent = set.size === EXTENSIONS[category].length ? '全部格式' : Array.from(set).join(', ');
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = '×';
      removeBtn.dataset.category = category;
      removeBtn.addEventListener('click', () => {
        selectedFilters[category] = new Set();
        if (category === activeCategory) {
          renderFormatMenu(activeCategory);
        }
        renderSelectedFilters();
        persistFilterState();
      });
      pill.appendChild(title);
      pill.appendChild(detail);
      pill.appendChild(removeBtn);
      selectedFiltersContainer.appendChild(pill);
    });
  }

  function collectSelectedExtensions() {
    const aggregate = new Set();
    Object.values(selectedFilters).forEach(set => {
      if (!set || set.size === 0) return;
      set.forEach(ext => aggregate.add(ext));
    });
    return Array.from(aggregate);
  }

  function setupDropdownInteractions() {
    categoryToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown(categoryDropdown);
    });
    formatToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown(formatDropdown);
    });
    document.addEventListener('click', (event) => {
      if (!preFilterSection.contains(event.target)) {
        closeDropdowns();
      }
    });
    preFilterSection.addEventListener('click', (event) => {
      if (
        event.target === preFilterSection ||
        (!categoryDropdown.contains(event.target) && !formatDropdown.contains(event.target))
      ) {
        closeDropdowns();
      }
    });
  }

  function toggleDropdown(target) {
    const isOpen = target.classList.contains('open');
    closeDropdowns();
    if (!isOpen) {
      target.classList.add('open');
    }
  }

  function closeDropdowns() {
    [categoryDropdown, formatDropdown].forEach(dropdown => dropdown.classList.remove('open'));
  }

  function closeDropdown(target) {
    target.classList.remove('open');
  }

  function persistFilterState() {
    const serialized = Object.entries(selectedFilters).reduce((acc, [category, set]) => {
      acc[category] = Array.from(set);
      return acc;
    }, {});

    chrome.storage.local.set({
      [FILTER_STORAGE_KEY]: serialized,
      [FILTER_CATEGORY_KEY]: activeCategory
    });
  }

  function restoreFilters(callback) {
    chrome.storage.local.get([FILTER_STORAGE_KEY, FILTER_CATEGORY_KEY], (result) => {
      const storedSelections = result[FILTER_STORAGE_KEY];
      const hasStoredSelections = !!storedSelections;

      if (hasStoredSelections) {
        Object.entries(storedSelections).forEach(([category, values]) => {
          if (!EXTENSIONS[category]) return;
          const validValues = Array.isArray(values) ? values.filter(ext => EXTENSIONS[category].includes(ext)) : [];
          selectedFilters[category] = new Set(validValues);
        });
      }

      Object.keys(EXTENSIONS).forEach(category => {
        if (!selectedFilters[category] || !(selectedFilters[category] instanceof Set)) {
          selectedFilters[category] = new Set();
        }
      });

      const storedCategory = result[FILTER_CATEGORY_KEY];
      if (storedCategory && CATEGORY_LABELS[storedCategory]) {
        activeCategory = storedCategory;
      }

      const hasAnySelection = Object.values(selectedFilters).some(set => set.size > 0);
      if (!hasStoredSelections || !hasAnySelection) {
        selectedFilters.docs = new Set(EXTENSIONS.docs);
        activeCategory = 'docs';
      }

      if (typeof callback === 'function') {
        callback();
      }
    });
  }

});

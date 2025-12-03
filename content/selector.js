// DOM选择器 - 用于在页面上选择特定的DOM元素作为搜索范围
let selectorOverlay = null;
let currentElement = null;
let elementStack = []; // 存储当前hover元素的所有父元素
let currentIndex = 0; // 当前在elementStack中的索引

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startElementSelection') {
    startElementSelection();
    sendResponse({ success: true });
  } else if (request.action === 'stopElementSelection') {
    stopElementSelection();
    sendResponse({ success: true });
  }
});

function startElementSelection() {
  // 如果已经存在overlay,先清除
  if (selectorOverlay) {
    stopElementSelection();
  }

  // 创建overlay容器
  selectorOverlay = document.createElement('div');
  selectorOverlay.id = 'omnifetch-selector-overlay';
  selectorOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 2147483647;
    pointer-events: none;
  `;

  // 创建高亮框
  const highlightBox = document.createElement('div');
  highlightBox.id = 'omnifetch-highlight-box';
  highlightBox.style.cssText = `
    position: fixed;
    border: 2px solid #3b82f6;
    background: rgba(59, 130, 246, 0.1);
    pointer-events: none;
    transition: all 0.1s ease;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
  `;

  // 创建信息提示框
  const infoBox = document.createElement('div');
  infoBox.id = 'omnifetch-info-box';
  infoBox.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 2147483647;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    pointer-events: none;
  `;
  infoBox.innerHTML = `
    <div style="text-align: center;">
      <div style="margin-bottom: 6px; font-weight: 600;">选择搜索范围</div>
      <div style="font-size: 12px; opacity: 0.9;">
        <span style="display: inline-block; margin: 0 8px;">↑↓ 切换层级</span>
        <span style="display: inline-block; margin: 0 8px;">点击 确认选择</span>
        <span style="display: inline-block; margin: 0 8px;">ESC 取消</span>
      </div>
      <div id="omnifetch-element-path" style="margin-top: 8px; font-size: 11px; opacity: 0.7; font-family: monospace;"></div>
    </div>
  `;

  selectorOverlay.appendChild(highlightBox);
  selectorOverlay.appendChild(infoBox);
  document.body.appendChild(selectorOverlay);

  // 添加事件监听器
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
}

function stopElementSelection() {
  if (selectorOverlay) {
    selectorOverlay.remove();
    selectorOverlay = null;
  }
  
  document.removeEventListener('mousemove', handleMouseMove, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);
  
  currentElement = null;
  elementStack = [];
  currentIndex = 0;
}

function handleMouseMove(e) {
  e.preventDefault();
  e.stopPropagation();
  
  const target = e.target;
  
  // 忽略我们自己的overlay元素
  if (target.closest('#omnifetch-selector-overlay')) {
    return;
  }
  
  // 构建元素栈(从当前元素到body)
  elementStack = [];
  let el = target;
  while (el && el !== document.body) {
    elementStack.push(el);
    el = el.parentElement;
  }
  elementStack.push(document.body);
  
  currentIndex = 0;
  currentElement = elementStack[currentIndex];
  
  updateHighlight();
}

function handleKeyDown(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    stopElementSelection();
    return;
  }
  
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    e.stopPropagation();
    // 向上移动(选择父元素)
    if (currentIndex < elementStack.length - 1) {
      currentIndex++;
      currentElement = elementStack[currentIndex];
      updateHighlight();
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    e.stopPropagation();
    // 向下移动(选择子元素)
    if (currentIndex > 0) {
      currentIndex--;
      currentElement = elementStack[currentIndex];
      updateHighlight();
    }
  }
}

function handleClick(e) {
  e.preventDefault();
  e.stopPropagation();
  
  // 忽略我们自己的overlay元素
  if (e.target.closest('#omnifetch-selector-overlay')) {
    return;
  }
  
  if (currentElement) {
    // 生成CSS选择器
    const selector = generateSelector(currentElement);
    
    // 获取当前网站的URL(只保存origin,不包含路径)
    const siteUrl = window.location.origin;
    
    // 保存选择器到storage
    chrome.storage.local.set({ 
      searchScope: selector,
      searchScopeDisplay: getElementDescription(currentElement),
      searchScopeUrl: siteUrl  // 保存网站URL
    }, () => {
      // 尝试通知popup更新显示(popup可能已关闭,这是正常的)
      chrome.runtime.sendMessage({
        action: 'scopeSelected',
        selector: selector,
        display: getElementDescription(currentElement)
      }, (response) => {
        // 静默处理错误,popup关闭时会失败,这是预期的行为
        if (chrome.runtime.lastError) {
          // Popup已关闭,忽略错误
          console.log('Scope selected and saved. Popup is closed.');
        }
      });
      
      stopElementSelection();
    });
  }
}

function updateHighlight() {
  if (!currentElement || !selectorOverlay) return;
  
  const highlightBox = selectorOverlay.querySelector('#omnifetch-highlight-box');
  const pathDisplay = selectorOverlay.querySelector('#omnifetch-element-path');
  
  if (highlightBox) {
    const rect = currentElement.getBoundingClientRect();
    // 使用fixed定位,直接使用getBoundingClientRect的值,不需要加scrollY/scrollX
    highlightBox.style.top = `${rect.top}px`;
    highlightBox.style.left = `${rect.left}px`;
    highlightBox.style.width = `${rect.width}px`;
    highlightBox.style.height = `${rect.height}px`;
  }
  
  if (pathDisplay) {
    pathDisplay.textContent = generateSelector(currentElement);
  }
}

function generateSelector(element) {
  if (!element || element === document.body) {
    return 'body';
  }
  
  // 如果元素有ID,优先使用ID
  if (element.id) {
    return `#${element.id}`;
  }
  
  // 构建路径选择器
  const path = [];
  let current = element;
  
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    
    // 添加类名(最多2个)
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(c => c && !c.startsWith('omnifetch-'));
      if (classes.length > 0) {
        selector += '.' + classes.slice(0, 2).join('.');
      }
    }
    
    // 如果需要,添加nth-child
    if (current.parentElement) {
      const siblings = Array.from(current.parentElement.children).filter(
        child => child.tagName === current.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }
    
    path.unshift(selector);
    current = current.parentElement;
    
    // 限制路径深度
    if (path.length >= 5) break;
  }
  
  return path.join(' > ');
}

function getElementDescription(element) {
  if (!element) return '整个页面';
  
  if (element === document.body) {
    return 'body (整个页面)';
  }
  
  let desc = element.tagName.toLowerCase();
  
  if (element.id) {
    desc += `#${element.id}`;
  } else if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/).filter(c => c && !c.startsWith('omnifetch-'));
    if (classes.length > 0) {
      desc += '.' + classes.slice(0, 2).join('.');
    }
  }
  
  return desc;
}

# OmniFetch - Universal Web Resource Batch Downloader

[English](README.md) | [中文](README_zh-CN.md)

OmniFetch is a powerful browser extension designed to help users batch download various types of static resources from any webpage. Whether it's PDF documents, images, videos, or audio, OmniFetch can scan and download them all with one click.

## ✨ Features

- **Full Site Scan**: Automatically detect and extract all static resource links from the webpage.
- **Multi-Format Support**:
  - 📄 Documents: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV
  - 🖼️ Images: JPG, PNG, GIF, WEBP, SVG, BMP, TIFF
  - 🎬 Video: MP4, WEBM, MKV, AVI, MOV, FLV, WMV
  - 🎵 Audio: MP3, WAV, OGG, FLAC, M4A, AAC
  - 📦 Archives: ZIP, RAR, 7Z, TAR, GZ
- **Smart Recognition**:
  - Automatically identifies links in `<a>` tags.
  - Automatically identifies media resources in `<img>`, `<video>`, `<audio>` tags.
  - Smartly handles relative paths and full URLs.
- **Flexible Configuration**:
  - **File Filtering**: Filter files to download by type.
  - **Batch Management**: Preview the file list before downloading, support renaming and deleting unwanted files.
  - **Custom Directory**: Defaults to the current website domain as the folder name, supports custom modification.
  - **Download Delay**: Set download interval (default 10ms) to prevent being rate-limited by servers.
- **Convenient Access**:
  - Supports one-click scan via right-click menu.
  - Click the browser toolbar icon to open the operation panel.

## 🚀 Installation

### Development Mode Installation
1. Clone or download this repository to your local machine.
2. Open Chrome browser and visit `chrome://extensions/`.
3. Enable **"Developer mode"** in the top right corner.
4. Click **"Load unpacked"**.
5. Select the folder where this project is located.

## 📖 Usage

1. **Open Target Webpage**: Visit the website where you want to download resources.
2. **Start Extension**:
   - Click the OmniFetch icon in the browser toolbar.
   - Or right-click on the page and select **"Batch Download All Files"**.
3. **Scan Resources**:
   - In the popup panel, check the file types you need (e.g., Docs, Images).
   - Click the **"Scan for Files"** button.
4. **Manage and Download**:
   - After scanning, the list will show all found files.
   - You can uncheck unwanted files or click the `×` on the right to delete them.
   - You can modify filenames or set the download folder name at the top.
   - Click **"Download Selected"** to start batch downloading.

## 🛠️ Development

### Project Structure
```
OmniFetch/
├── manifest.json        # Extension configuration
├── background/          # Background service script
│   └── background.js
├── content/             # Content script (injected into page)
│   └── content.js
├── popup/               # Popup UI
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
└── icons/               # Icon resources
```

### Permissions
- `activeTab`: Access current tab information.
- `downloads`: Invoke browser download function.
- `contextMenus`: Create right-click menus.
- `storage`: Save user settings (e.g., folder name, delay time).
- `scripting`: Dynamically inject scripts.

## 📄 License

This project is licensed under the [MIT License](LICENSE).

# OmniFetch - 全能网页资源批量下载器

[English](README.md) | [中文](README_zh-CN.md)


OmniFetch 是一款强大的浏览器插件，旨在帮助用户从任何网页批量下载各种类型的静态资源。无论是 PDF 文档、图片、视频还是音频，OmniFetch 都能一键扫描并批量下载。

## ✨ 主要功能

- **全站扫描**：自动检测并提取网页中的所有静态资源链接。
- **多格式支持**：
  - 📄 文档：PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV
  - 🖼️ 图片：JPG, PNG, GIF, WEBP, SVG, BMP, TIFF
  - 🎬 视频：MP4, WEBM, MKV, AVI, MOV, FLV, WMV
  - 🎵 音频：MP3, WAV, OGG, FLAC, M4A, AAC
  - 📦 压缩包：ZIP, RAR, 7Z, TAR, GZ
- **智能识别**：
  - 自动识别 `<a>` 标签中的链接。
  - 自动识别 `<img>`, `<video>`, `<audio>` 等媒体标签资源。
  - 智能处理相对路径和完整 URL。
- **灵活配置**：
  - **文件过滤**：按类型筛选需要下载的文件。
  - **批量管理**：下载前预览文件列表，支持重命名和删除不需要的文件。
  - **自定义目录**：默认以当前网站域名为文件夹名称，支持自定义修改。
  - **下载延迟**：设置下载间隔时间（默认 10ms），防止因请求过快被服务器限制。
- **便捷入口**：
  - 支持右键菜单一键扫描。
  - 点击浏览器工具栏图标即可唤起操作面板。

## 🚀 安装指南

### 开发模式安装
1. 克隆或下载本项目到本地。
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`。
3. 开启右上角的 **"开发者模式"**。
4. 点击 **"加载已解压的扩展程序"**。
5. 选择本项目所在的文件夹。

## 📖 使用说明

1. **打开目标网页**：访问你想要下载资源的网站。
2. **启动插件**：
   - 点击浏览器右上角的 OmniFetch 图标。
   - 或者在页面空白处右键，选择 **"Batch Download All Files"**。
3. **扫描资源**：
   - 在弹出的面板中，勾选你需要的文件类型（如 Docs, Images 等）。
   - 点击 **"Scan for Files"** 按钮。
4. **管理与下载**：
   - 扫描完成后，列表会显示所有发现的文件。
   - 你可以取消勾选不需要的文件，或者点击右侧的 `×` 删除。
   - 可以修改文件名，或在上方设置下载文件夹名称。
   - 点击 **"Download Selected"** 开始批量下载。

## 🛠️ 开发说明

### 项目结构
```
OmniFetch/
├── manifest.json        # 插件配置文件
├── background/          # 后台服务脚本
│   └── background.js
├── content/             # 内容脚本（注入页面）
│   └── content.js
├── popup/               # 弹出层 UI
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
└── icons/               # 图标资源
```

### 权限说明
- `activeTab`: 获取当前标签页信息。
- `downloads`: 调用浏览器下载功能。
- `contextMenus`: 创建右键菜单。
- `storage`: 保存用户设置（如文件夹名、延迟时间）。
- `scripting`: 动态注入脚本。

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源许可证。

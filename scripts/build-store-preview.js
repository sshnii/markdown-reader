const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.resolve(__dirname, "..");
const assetsDir = path.join(root, "dist", "store-assets");
fs.mkdirSync(assetsDir, { recursive: true });

const inlineImage = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="300" viewBox="0 0 960 300" role="img" aria-label="Markdown Reader 图片预览示例">
  <rect width="960" height="300" rx="18" fill="#f8fafc"/>
  <rect x="1" y="1" width="958" height="298" rx="17" fill="none" stroke="#d9dee8"/>
  <rect x="52" y="58" width="245" height="184" rx="14" fill="#ffffff" stroke="#d9dee8"/>
  <text x="82" y="96" fill="#101827" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="22" font-weight="700">产品介绍.md</text>
  <rect x="82" y="120" width="144" height="10" rx="5" fill="#cbd5e1"/>
  <rect x="82" y="146" width="180" height="10" rx="5" fill="#e2e8f0"/>
  <rect x="82" y="172" width="128" height="10" rx="5" fill="#e2e8f0"/>
  <rect x="82" y="200" width="150" height="28" rx="7" fill="#e8f0ff"/>
  <text x="100" y="219" fill="#0f62fe" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="14" font-weight="700">含图片与目录</text>
  <path d="M334 150h122" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"/>
  <path d="M440 125l35 25-35 25" fill="none" stroke="#94a3b8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="504" y="38" width="382" height="224" rx="16" fill="#ffffff" stroke="#d9dee8"/>
  <rect x="534" y="72" width="95" height="138" rx="10" fill="#f8fafc" stroke="#d9dee8"/>
  <text x="556" y="102" fill="#667085" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="13" font-weight="700">目录</text>
  <rect x="556" y="122" width="50" height="7" rx="3.5" fill="#0f62fe" opacity=".24"/>
  <rect x="556" y="142" width="40" height="7" rx="3.5" fill="#cbd5e1"/>
  <rect x="568" y="162" width="34" height="7" rx="3.5" fill="#e2e8f0"/>
  <rect x="556" y="182" width="46" height="7" rx="3.5" fill="#cbd5e1"/>
  <rect x="650" y="72" width="202" height="138" rx="10" fill="#ffffff" stroke="#d9dee8"/>
  <text x="674" y="106" fill="#101827" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="20" font-weight="750">渲染后的阅读页</text>
  <rect x="674" y="124" width="126" height="8" rx="4" fill="#cbd5e1"/>
  <rect x="674" y="143" width="154" height="8" rx="4" fill="#e2e8f0"/>
  <rect x="674" y="165" width="68" height="32" rx="7" fill="#e8f0ff"/>
  <rect x="754" y="165" width="68" height="32" rx="7" fill="#ecfdf3"/>
  <text x="685" y="186" fill="#0f62fe" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="13" font-weight="700">图片</text>
  <text x="765" y="186" fill="#15803d" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="13" font-weight="700">目录</text>
</svg>`;

const markdown = `# Markdown Reader 产品介绍

Markdown Reader 是一个轻量的 Chrome 本地 Markdown 阅读扩展。打开本地 \`.md\` 文档时，它会自动渲染为清晰的 HTML 阅读页，适合阅读产品说明、技术文档、分析报告和项目 README。

## 核心功能

- 自动识别并渲染本地 Markdown 文档
- 增加文档目录，按标题生成左侧导航
- 支持 Markdown 文档中的图片，相对路径会按当前文档位置解析
- 支持表格、代码块、引用、任务列表和分割线
- 支持浅色和黑色主题切换

![Markdown Reader 图片预览示例](markdown-reader-inline-image.svg)

## 文档目录

当文档包含多个标题时，阅读页会自动显示目录。点击目录项即可跳转到对应章节，长文档阅读更直接。

### 章节跳转

目录会展示 1 到 3 级标题，适合产品文档、接口说明和分析报告。

## 图片支持

Markdown 中的图片会按文档所在目录解析。比如 \`images/example.png\` 会指向当前 Markdown 文件旁边的 \`images\` 文件夹。

| 能力 | 支持情况 |
| --- | --- |
| 本地图片 | 支持 |
| 相对路径 | 支持 |
| 中英文路径 | 支持 |

## 使用方式

1. 安装扩展。
2. 在扩展详情中开启“允许访问文件网址”。
3. 使用 Chrome 打开本地 Markdown 文件。
`;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const viewerSource = fs.readFileSync(path.join(root, "markdown-viewer.js"), "utf8");
const cssMatch = viewerSource.match(/function stylesheet\(\) \{\n\s*return `([\s\S]*?)`;\n\s*\}/);
if (!cssMatch) {
  throw new Error("Could not extract markdown viewer stylesheet");
}

const inlineImagePath = path.join(assetsDir, "markdown-reader-inline-image.svg");
const markdownPath = path.join(assetsDir, "markdown-reader-product-intro.md");
fs.writeFileSync(inlineImagePath, inlineImage);
fs.writeFileSync(markdownPath, markdown);

const { renderMarkdownDocument } = require(path.join(root, "markdown-viewer.js"));
const rendered = renderMarkdownDocument(markdown, pathToFileURL(markdownPath).href);
const toc = rendered.toc.map(item => {
  const levelClass = " level-" + Math.min(Math.max(item.level, 1), 3);
  return `<a class="md-toc-link${levelClass}" href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a>`;
}).join("");

const html = `<!DOCTYPE html>
<html lang="zh-CN" data-md-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Markdown Reader 产品介绍.md</title>
  <style>${cssMatch[1]}</style>
  <style>
    body.md-viewer-body { min-height: 800px; }
    .md-layout { margin-top: 28px; margin-bottom: 28px; }
    .md-viewer-shell { min-height: 720px; }
    .md-viewer-content img {
      display: block;
      margin: 18px 0 24px;
      border: 1px solid var(--md-border);
    }
  </style>
</head>
<body class="md-viewer-body">
  <button type="button" class="md-theme-toggle" title="切换到黑色模式" aria-label="切换到黑色模式">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.8 6.8 0 0 0 9.8 9.8Z"/></svg>
  </button>
  <div class="md-layout has-toc">
    <aside class="md-toc" aria-label="文档目录">
      <div class="md-toc-title">目录</div>
      <nav class="md-toc-nav">${toc}</nav>
    </aside>
    <main class="md-viewer-shell">
      <div class="md-viewer-file">Markdown Reader 产品介绍.md</div>
      <article class="md-viewer-content">${rendered.html}</article>
    </main>
  </div>
</body>
</html>`;

const previewPath = path.join(assetsDir, "markdown-reader-preview.html");
fs.writeFileSync(previewPath, html);
console.log(previewPath);

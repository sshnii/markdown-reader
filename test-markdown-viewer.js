const assert = require("assert");
const { renderMarkdownDocument } = require("./markdown-viewer");

const rendered = renderMarkdownDocument([
  "# 介绍",
  "",
  "正文",
  "",
  "## 使用方式",
  "",
  "### 使用方式",
  "",
  "#### 不进入目录"
].join("\n"), "file:///tmp/readme.md");

assert.deepStrictEqual(rendered.toc, [
  { level: 1, text: "介绍", id: "heading-1" },
  { level: 2, text: "使用方式", id: "heading-2" },
  { level: 3, text: "使用方式", id: "heading-3" }
]);

assert.ok(rendered.html.includes('<h1 id="heading-1">介绍</h1>'));
assert.ok(rendered.html.includes('<h2 id="heading-2">使用方式</h2>'));
assert.ok(rendered.html.includes('<h3 id="heading-3">使用方式</h3>'));
assert.ok(rendered.html.includes("<h4>不进入目录</h4>"));

console.log("markdown viewer tests passed");

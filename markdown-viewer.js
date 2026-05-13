(function () {
  "use strict";

  const MD_EXT_RE = /\.(md|markdown|mdown|mkd)$/i;
  const THEME_KEY = "markdown-reader-theme";
  const THEMES = {
    light: {
      label: "切换到黑色模式",
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.8 6.8 0 0 0 9.8 9.8Z"/></svg>'
    },
    dark: {
      label: "切换到浅色模式",
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>'
    }
  };

  function isMarkdownFileUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "file:" && MD_EXT_RE.test(decodeURIComponent(parsed.pathname));
    } catch {
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function normalizeLines(markdown) {
    return String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
  }

  function isFence(line) {
    return /^ {0,3}(```|~~~)/.test(line);
  }

  function isHeading(line) {
    return /^ {0,3}#{1,6}\s+\S/.test(line);
  }

  function isHorizontalRule(line) {
    return /^ {0,3}(([-*_])\s*){3,}$/.test(line.trim());
  }

  function isBlockquote(line) {
    return /^ {0,3}>\s?/.test(line);
  }

  function isListItem(line) {
    return /^ {0,3}([-+*]|\d+[.)])\s+/.test(line);
  }

  function isTableDivider(line) {
    const trimmed = line.trim();
    if (!trimmed.includes("|")) return false;
    return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(trimmed);
  }

  function isTableStart(lines, index) {
    return Boolean(lines[index] && lines[index].includes("|") && lines[index + 1] && isTableDivider(lines[index + 1]));
  }

  function splitTableRow(line) {
    let row = line.trim();
    if (row.startsWith("|")) row = row.slice(1);
    if (row.endsWith("|")) row = row.slice(0, -1);
    return row.split("|").map(cell => cell.trim());
  }

  function parseAlignments(dividerLine) {
    return splitTableRow(dividerLine).map(cell => {
      const left = cell.startsWith(":");
      const right = cell.endsWith(":");
      if (left && right) return "center";
      if (right) return "right";
      return "left";
    });
  }

  function attrForUrl(url, baseUrl) {
    const trimmed = String(url || "").trim();
    if (!trimmed) return "";
    try {
      return new URL(trimmed, baseUrl).href;
    } catch {
      return trimmed;
    }
  }

  function renderInline(markdown, baseUrl) {
    const codeSpans = [];
    const htmlSpans = [];
    let text = String(markdown || "").replace(/`([^`]+)`/g, (_, code) => {
      const token = "\u0000CODE" + codeSpans.length + "\u0000";
      codeSpans.push("<code>" + escapeHtml(code) + "</code>");
      return token;
    });

    text = escapeHtml(text);

    const preserveHtml = html => {
      const token = "\u0000HTML" + htmlSpans.length + "\u0000";
      htmlSpans.push(html);
      return token;
    };

    text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, alt, url, title) => {
      const src = escapeAttr(attrForUrl(url, baseUrl));
      const safeAlt = escapeAttr(alt);
      const safeTitle = title ? ' title="' + escapeAttr(title) + '"' : "";
      return preserveHtml('<img src="' + src + '" alt="' + safeAlt + '"' + safeTitle + ">");
    });

    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, label, url, title) => {
      const href = escapeAttr(attrForUrl(url, baseUrl));
      const safeTitle = title ? ' title="' + escapeAttr(title) + '"' : "";
      return preserveHtml('<a href="' + href + '"' + safeTitle + ">" + label + "</a>");
    });

    text = text
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+)__/g, "<strong>$1</strong>")
      .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
      .replace(/_([^_\n]+)_/g, "<em>$1</em>")
      .replace(/~~([^~]+)~~/g, "<del>$1</del>");

    text = text.replace(/  \n/g, "<br>");

    htmlSpans.forEach((html, index) => {
      text = text.replace(new RegExp("\u0000HTML" + index + "\u0000", "g"), html);
    });

    codeSpans.forEach((html, index) => {
      text = text.replace(new RegExp("\u0000CODE" + index + "\u0000", "g"), html);
    });

    return text;
  }

  function plainInlineText(markdown) {
    return String(markdown || "")
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(\*|_)(.*?)\1/g, "$2")
      .replace(/~~(.*?)~~/g, "$1")
      .replace(/[<>]/g, "")
      .trim();
  }

  function renderTable(lines, start, baseUrl) {
    const headers = splitTableRow(lines[start]);
    const alignments = parseAlignments(lines[start + 1]);
    let index = start + 2;
    const rows = [];
    while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
      rows.push(splitTableRow(lines[index]));
      index += 1;
    }

    const head = headers.map((cell, i) => {
      const align = alignments[i] || "left";
      return '<th style="text-align:' + align + '">' + renderInline(cell, baseUrl) + "</th>";
    }).join("");

    const body = rows.map(row => {
      const cells = headers.map((_, i) => {
        const align = alignments[i] || "left";
        return '<td style="text-align:' + align + '">' + renderInline(row[i] || "", baseUrl) + "</td>";
      }).join("");
      return "<tr>" + cells + "</tr>";
    }).join("");

    return {
      html: "<table><thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table>",
      next: index
    };
  }

  function renderList(lines, start, baseUrl) {
    const first = lines[start].match(/^ {0,3}([-+*]|\d+[.)])\s+(.*)$/);
    const ordered = Boolean(first && /^\d/.test(first[1]));
    const tag = ordered ? "ol" : "ul";
    let index = start;
    const items = [];

    while (index < lines.length) {
      const match = lines[index].match(/^ {0,3}([-+*]|\d+[.)])\s+(.*)$/);
      if (!match || /^\d/.test(match[1]) !== ordered) break;

      let value = match[2];
      index += 1;
      while (index < lines.length && /^ {2,}\S/.test(lines[index]) && !isListItem(lines[index])) {
        value += "\n" + lines[index].trim();
        index += 1;
      }

      const task = value.match(/^\[([ xX])\]\s+(.*)$/);
      if (task) {
        const checked = task[1].toLowerCase() === "x" ? " checked" : "";
        items.push('<li class="task"><input type="checkbox" disabled' + checked + "> " + renderInline(task[2], baseUrl) + "</li>");
      } else {
        items.push("<li>" + renderInline(value, baseUrl) + "</li>");
      }
    }

    return {
      html: "<" + tag + ">" + items.join("") + "</" + tag + ">",
      next: index
    };
  }

  function renderBlocks(lines, baseUrl, state) {
    const html = [];
    let index = 0;
    const renderState = state || { toc: [], headingIndex: 0 };

    while (index < lines.length) {
      const line = lines[index];

      if (!line.trim()) {
        index += 1;
        continue;
      }

      if (isFence(line)) {
        const fence = line.match(/^ {0,3}(```+|~~~+)\s*([A-Za-z0-9_-]*)?/);
        const marker = fence ? fence[1][0] : "`";
        const lang = fence && fence[2] ? fence[2] : "";
        index += 1;
        const code = [];
        while (index < lines.length && !new RegExp("^ {0,3}" + marker + "{3,}\\s*$").test(lines[index])) {
          code.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) index += 1;
        const langClass = lang ? ' class="language-' + escapeAttr(lang) + '"' : "";
        html.push("<pre><code" + langClass + ">" + escapeHtml(code.join("\n")) + "</code></pre>");
        continue;
      }

      if (isHeading(line)) {
        const match = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*$/);
        const level = match[1].length;
        if (level <= 3) {
          renderState.headingIndex += 1;
          const id = "heading-" + renderState.headingIndex;
          renderState.toc.push({
            level,
            text: plainInlineText(match[2]) || "标题 " + renderState.headingIndex,
            id
          });
          html.push("<h" + level + ' id="' + id + '">' + renderInline(match[2], baseUrl) + "</h" + level + ">");
        } else {
          html.push("<h" + level + ">" + renderInline(match[2], baseUrl) + "</h" + level + ">");
        }
        index += 1;
        continue;
      }

      if (isHorizontalRule(line)) {
        html.push("<hr>");
        index += 1;
        continue;
      }

      if (isTableStart(lines, index)) {
        const table = renderTable(lines, index, baseUrl);
        html.push(table.html);
        index = table.next;
        continue;
      }

      if (isBlockquote(line)) {
        const quote = [];
        while (index < lines.length && (isBlockquote(lines[index]) || !lines[index].trim())) {
          quote.push(lines[index].replace(/^ {0,3}>\s?/, ""));
          index += 1;
        }
        html.push("<blockquote>" + renderBlocks(quote, baseUrl, renderState) + "</blockquote>");
        continue;
      }

      if (isListItem(line)) {
        const list = renderList(lines, index, baseUrl);
        html.push(list.html);
        index = list.next;
        continue;
      }

      const paragraph = [];
      while (
        index < lines.length &&
        lines[index].trim() &&
        !isFence(lines[index]) &&
        !isHeading(lines[index]) &&
        !isHorizontalRule(lines[index]) &&
        !isTableStart(lines, index) &&
        !isBlockquote(lines[index]) &&
        !isListItem(lines[index])
      ) {
        paragraph.push(lines[index]);
        index += 1;
      }
      html.push("<p>" + renderInline(paragraph.join("\n"), baseUrl).replace(/\n/g, " ") + "</p>");
    }

    return html.join("\n");
  }

  function renderMarkdown(markdown, baseUrl) {
    return renderMarkdownDocument(markdown, baseUrl).html;
  }

  function renderMarkdownDocument(markdown, baseUrl) {
    const state = { toc: [], headingIndex: 0 };
    const html = renderBlocks(normalizeLines(markdown), baseUrl || location.href, state);
    return {
      html,
      toc: state.toc
    };
  }

  function renderToc(toc) {
    if (!toc || toc.length < 2) return "";
    const items = toc.map(item => {
      const levelClass = " level-" + Math.min(Math.max(item.level, 1), 3);
      return '<a class="md-toc-link' + levelClass + '" href="#' + escapeAttr(item.id) + '">' + escapeHtml(item.text) + "</a>";
    }).join("");
    return '<aside class="md-toc" aria-label="文档目录">' +
      '<div class="md-toc-title">目录</div>' +
      '<nav class="md-toc-nav">' + items + "</nav>" +
      "</aside>";
  }

  function getPlainMarkdownFromDocument() {
    const pre = document.body && document.body.children.length === 1 && document.body.children[0].tagName === "PRE"
      ? document.body.children[0]
      : null;
    return pre ? pre.textContent : document.body.innerText;
  }

  function getStoredTheme() {
    try {
      const value = localStorage.getItem(THEME_KEY);
      return value === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  }

  function storeTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // File pages can deny storage in some Chrome privacy configurations.
    }
  }

  function applyTheme(theme) {
    const normalized = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-md-theme", normalized);
    document.documentElement.style.colorScheme = normalized === "dark" ? "dark" : "light";
    const button = document.getElementById("mdThemeToggle");
    if (!button) return;
    const next = normalized === "dark" ? THEMES.dark : THEMES.light;
    button.innerHTML = next.icon;
    button.title = next.label;
    button.setAttribute("aria-label", next.label);
  }

  function setupThemeToggle() {
    const button = document.getElementById("mdThemeToggle");
    if (!button) return;
    applyTheme(getStoredTheme());
    button.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-md-theme") === "dark" ? "dark" : "light";
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next);
      storeTheme(next);
    });
  }

  function stylesheet() {
    return `
      :root {
        color-scheme: light;
        --md-bg: #f6f8fb;
        --md-paper: #ffffff;
        --md-text: #20242c;
        --md-muted: #6b7280;
        --md-border: #d9dee8;
        --md-link: #0f62fe;
        --md-code-bg: #f1f5f9;
        --md-heading: #101827;
        --md-subtle-border: #edf0f5;
        --md-pre-bg: #0f172a;
        --md-pre-text: #e5e7eb;
        --md-quote-bg: #f8fafc;
        --md-quote-text: #4b5563;
        --md-quote-border: #cbd5e1;
        --md-table-head: #f8fafc;
        --md-button-bg: #ffffff;
        --md-button-hover: #f1f5f9;
        --md-button-text: #334155;
        --md-toc-active: #e8f0ff;
        --md-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
      }
      :root[data-md-theme="dark"] {
        color-scheme: dark;
        --md-bg: #080b10;
        --md-paper: #111720;
        --md-text: #d8dee9;
        --md-muted: #94a3b8;
        --md-border: #263241;
        --md-link: #7ab7ff;
        --md-code-bg: #1d2733;
        --md-heading: #f8fafc;
        --md-subtle-border: #253041;
        --md-pre-bg: #020617;
        --md-pre-text: #e2e8f0;
        --md-quote-bg: #151d29;
        --md-quote-text: #cbd5e1;
        --md-quote-border: #475569;
        --md-table-head: #17202c;
        --md-button-bg: #17202c;
        --md-button-hover: #223044;
        --md-button-text: #e2e8f0;
        --md-toc-active: #16263d;
        --md-shadow: 0 12px 34px rgba(0, 0, 0, 0.35);
      }
      html { scroll-behavior: smooth; }
      * { box-sizing: border-box; }
      body.md-viewer-body {
        margin: 0;
        background: var(--md-bg);
        color: var(--md-text);
        font: 16px/1.7 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .md-layout {
        display: grid;
        grid-template-columns: 248px minmax(0, 960px);
        gap: 24px;
        align-items: start;
        width: min(1256px, calc(100vw - 32px));
        margin: 32px auto;
      }
      .md-layout:not(.has-toc) {
        display: block;
        width: min(960px, calc(100vw - 32px));
      }
      .md-viewer-shell {
        min-width: 0;
        margin: 0;
        padding: 36px 44px 48px;
        background: var(--md-paper);
        border: 1px solid var(--md-border);
        border-radius: 8px;
        box-shadow: var(--md-shadow);
      }
      .md-toc {
        position: sticky;
        top: 32px;
        max-height: calc(100vh - 64px);
        overflow: auto;
        padding: 14px 10px;
        background: var(--md-paper);
        border: 1px solid var(--md-border);
        border-radius: 8px;
        box-shadow: var(--md-shadow);
      }
      .md-toc-title {
        margin: 0 8px 8px;
        color: var(--md-muted);
        font-size: 12px;
        font-weight: 650;
      }
      .md-toc-nav {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .md-toc-link {
        display: block;
        min-width: 0;
        padding: 5px 8px;
        color: var(--md-muted);
        border-radius: 6px;
        font-size: 13px;
        line-height: 1.35;
        text-decoration: none;
        overflow-wrap: anywhere;
      }
      .md-toc-link:hover,
      .md-toc-link:focus-visible {
        color: var(--md-link);
        background: var(--md-toc-active);
        outline: none;
      }
      .md-toc-link.level-2 { padding-left: 18px; }
      .md-toc-link.level-3 { padding-left: 30px; font-size: 12px; }
      .md-theme-toggle {
        position: fixed;
        top: 18px;
        right: 18px;
        z-index: 10;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        margin: 0;
        padding: 0;
        color: var(--md-button-text);
        background: var(--md-button-bg);
        border: 1px solid var(--md-border);
        border-radius: 8px;
        box-shadow: var(--md-shadow);
        cursor: pointer;
      }
      .md-theme-toggle:hover { background: var(--md-button-hover); }
      .md-theme-toggle:focus-visible {
        outline: 2px solid var(--md-link);
        outline-offset: 2px;
      }
      .md-theme-toggle svg {
        width: 19px;
        height: 19px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .md-viewer-file {
        margin: 0 0 24px;
        color: var(--md-muted);
        font-size: 13px;
        word-break: break-all;
      }
      .md-viewer-content > :first-child { margin-top: 0; }
      .md-viewer-content > :last-child { margin-bottom: 0; }
      h1, h2, h3, h4, h5, h6 {
        margin: 1.5em 0 0.55em;
        line-height: 1.28;
        color: var(--md-heading);
        font-weight: 700;
        scroll-margin-top: 24px;
      }
      h1 { padding-bottom: 0.35em; border-bottom: 1px solid var(--md-border); font-size: 2rem; }
      h2 { padding-bottom: 0.25em; border-bottom: 1px solid var(--md-subtle-border); font-size: 1.5rem; }
      h3 { font-size: 1.22rem; }
      h4 { font-size: 1.06rem; }
      p, ul, ol, blockquote, pre, table { margin: 0 0 1.1em; }
      a { color: var(--md-link); text-decoration-thickness: 1px; text-underline-offset: 3px; }
      img { max-width: 100%; height: auto; border-radius: 6px; }
      code {
        padding: 0.15em 0.35em;
        background: var(--md-code-bg);
        border-radius: 4px;
        font: 0.9em/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      pre {
        overflow: auto;
        padding: 16px;
        background: var(--md-pre-bg);
        color: var(--md-pre-text);
        border-radius: 8px;
      }
      pre code { padding: 0; background: transparent; color: inherit; }
      blockquote {
        padding: 0.2em 1em;
        color: var(--md-quote-text);
        border-left: 4px solid var(--md-quote-border);
        background: var(--md-quote-bg);
      }
      ul, ol { padding-left: 1.5em; }
      li + li { margin-top: 0.28em; }
      li.task { list-style: none; margin-left: -1.35em; }
      li.task input { margin-right: 0.45em; vertical-align: -0.1em; }
      table {
        width: 100%;
        border-collapse: collapse;
        display: block;
        overflow-x: auto;
      }
      th, td { padding: 8px 10px; border: 1px solid var(--md-border); }
      th { background: var(--md-table-head); font-weight: 650; }
      hr { margin: 1.8em 0; border: 0; border-top: 1px solid var(--md-border); }
      @media (max-width: 980px) {
        .md-layout {
          display: block;
          width: min(960px, calc(100vw - 32px));
        }
        .md-toc {
          position: static;
          max-height: 220px;
          margin-bottom: 16px;
        }
      }
      @media (max-width: 640px) {
        body.md-viewer-body { font-size: 15px; }
        .md-layout {
          width: 100%;
          margin: 0;
        }
        .md-toc {
          max-height: 180px;
          margin: 0;
          border-width: 0 0 1px;
          border-radius: 0;
          box-shadow: none;
        }
        .md-viewer-shell {
          width: 100%;
          min-height: 100vh;
          margin: 0;
          padding: 24px 18px 36px;
          border: 0;
          border-radius: 0;
          box-shadow: none;
        }
        .md-theme-toggle {
          top: 12px;
          right: 12px;
          width: 34px;
          height: 34px;
        }
      }
    `;
  }

  function renderCurrentMarkdownFile() {
    if (!isMarkdownFileUrl(location.href) || !document.body) return false;

    const markdown = getPlainMarkdownFromDocument();
    const filename = decodeURIComponent(location.pathname.split("/").pop() || "Markdown");
    const rendered = renderMarkdownDocument(markdown, location.href);
    const toc = renderToc(rendered.toc);

    document.title = filename;
    document.documentElement.lang = document.documentElement.lang || "zh-CN";
    document.head.innerHTML = "";
    const meta = document.createElement("meta");
    meta.setAttribute("charset", "utf-8");
    document.head.appendChild(meta);
    const title = document.createElement("title");
    title.textContent = filename;
    document.head.appendChild(title);
    const style = document.createElement("style");
    style.textContent = stylesheet();
    document.head.appendChild(style);

    document.body.className = "md-viewer-body";
    document.body.innerHTML =
      '<button type="button" class="md-theme-toggle" id="mdThemeToggle"></button>' +
      '<div class="md-layout' + (toc ? " has-toc" : "") + '">' +
      toc +
      '<main class="md-viewer-shell">' +
      '<div class="md-viewer-file">' + escapeHtml(filename) + "</div>" +
      '<article class="md-viewer-content">' + rendered.html + "</article>" +
      "</main>" +
      "</div>";
    setupThemeToggle();

    return true;
  }

  if (typeof document !== "undefined") {
    renderCurrentMarkdownFile();
  }

  if (typeof module !== "undefined") {
    module.exports = {
      isMarkdownFileUrl,
      renderMarkdown,
      renderMarkdownDocument
    };
  }
}());

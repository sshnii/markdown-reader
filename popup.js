(function () {
  "use strict";

  const statusBox = document.getElementById("statusBox");
  const statusTitle = document.getElementById("statusTitle");
  const statusDesc = document.getElementById("statusDesc");
  const guideBox = document.getElementById("guideBox");
  const openDetails = document.getElementById("openDetails");
  const checkAgain = document.getElementById("checkAgain");

  function setStatus(kind, title, desc) {
    statusBox.className = "status " + kind;
    statusTitle.textContent = title;
    statusDesc.textContent = desc;
    guideBox.hidden = kind !== "warn";
    openDetails.hidden = kind === "ok";
  }

  function checkFileAccess() {
    if (!chrome.extension || typeof chrome.extension.isAllowedFileSchemeAccess !== "function") {
      setStatus("warn", "无法自动检查权限", "请在扩展详情页确认已开启“允许访问文件网址”。");
      return;
    }

    chrome.extension.isAllowedFileSchemeAccess(allowed => {
      if (allowed) {
        setStatus("ok", "本地文件访问已开启", "现在打开本地 .md 文件时会自动渲染。");
      } else {
        setStatus("warn", "本地文件访问未开启", "渲染本地 .md 文件需要开启文件网址访问权限。");
      }
    });
  }

  function openExtensionDetails() {
    const url = "chrome://extensions/?id=" + chrome.runtime.id;
    chrome.tabs.create({ url });
  }

  openDetails.addEventListener("click", openExtensionDetails);
  checkAgain.addEventListener("click", checkFileAccess);
  checkFileAccess();
}());

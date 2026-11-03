(() => {
  "use strict";

  const reconnectButton = document.querySelector("[data-reconnect]");
  const statusMessage = document.querySelector("[data-status]");
  let navigationStarted = false;

  function resolveServerUrl() {
    const configuredUrl =
      window.__CLEANHUB_POS_RUNTIME__ &&
      window.__CLEANHUB_POS_RUNTIME__.serverUrl;

    if (typeof configuredUrl !== "string" || configuredUrl.length === 0) {
      return null;
    }

    try {
      const url = new URL(configuredUrl);
      if (
        (url.protocol !== "http:" && url.protocol !== "https:") ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      ) {
        return null;
      }
      return url;
    } catch {
      return null;
    }
  }

  const serverUrl = resolveServerUrl();

  function setStatus(message) {
    if (statusMessage) {
      statusMessage.textContent = message;
    }
  }

  function reconnect() {
    if (!serverUrl || navigationStarted) {
      return;
    }

    navigationStarted = true;
    if (reconnectButton) {
      reconnectButton.disabled = true;
      reconnectButton.textContent = "正在连接…";
    }
    setStatus("正在重新连接 POS 服务，请稍候。");

    // `reload()` reloads Capacitor's local errorPath. Replacing the location
    // with the validated public POS origin retries the actual remote service.
    window.location.replace(serverUrl.toString());
  }

  if (!serverUrl) {
    if (reconnectButton) {
      reconnectButton.disabled = true;
    }
    setStatus("此安装包没有配置 POS 服务地址，请联系管理员重新安装。");
    return;
  }

  if (!navigator.onLine) {
    setStatus("当前设备处于离线状态，恢复网络后将自动重连。");
  }

  reconnectButton?.addEventListener("click", reconnect);
  window.addEventListener("offline", () => {
    setStatus("当前设备处于离线状态，恢复网络后将自动重连。");
  });
  window.addEventListener("online", reconnect, { once: true });
})();

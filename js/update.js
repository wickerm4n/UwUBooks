(function (window) {
  'use strict';

  const UwUBooks = window.UwUBooks || {};
  const APP_CONFIG = UwUBooks.APP_CONFIG || {};
  const appVersion = String(APP_CONFIG.appVersion || '').trim();
  const versionUrl = APP_CONFIG.updateVersionUrl || 'version.json';
  const initialDelayMs = Number(APP_CONFIG.updateInitialDelayMs || 20000);
  const intervalMs = Number(APP_CONFIG.updateCheckIntervalMs || 300000);
  const reloadSessionKey = APP_CONFIG.updateReloadSessionKey || 'uwu-books.update-reloaded.v1';
  const noticeParam = 'uwuUpdated';

  function showUpdateNotice(version) {
    const ui = window.UwUBooks && window.UwUBooks.ui;
    const message = version ? `Die neue Version wurde geladen.` : 'Die neue Version wurde geladen.';
    if (ui && typeof ui.showToast === 'function') {
      ui.showToast('Seite aktualisiert', message, 'success');
    }
  }

  function consumeUpdateNotice() {
    try {
      const url = new URL(window.location.href);
      const updatedVersion = url.searchParams.get(noticeParam);
      if (!updatedVersion) return;

      url.searchParams.delete(noticeParam);
      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
      window.setTimeout(() => showUpdateNotice(updatedVersion), 450);
    } catch (_error) {
      // Kein kritischer Fehler. Die Seite soll auch ohne Hinweis normal funktionieren.
    }
  }

  function buildVersionUrl() {
    const url = new URL(versionUrl, window.location.href);
    url.searchParams.set('_', String(Date.now()));
    return url.toString();
  }

  async function fetchRemoteVersion() {
    if (window.location.protocol === 'file:') return '';

    const response = await fetch(buildVersionUrl(), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });

    if (!response.ok) return '';

    const data = await response.json();
    return String(data.version || data.appVersion || '').trim();
  }

  function reloadOnceForVersion(remoteVersion) {
    const sessionValue = sessionStorage.getItem(reloadSessionKey);
    if (sessionValue === remoteVersion) return;

    sessionStorage.setItem(reloadSessionKey, remoteVersion);

    const url = new URL(window.location.href);
    url.searchParams.set(noticeParam, remoteVersion);
    url.searchParams.set('_', String(Date.now()));
    window.location.replace(url.toString());
  }

  async function checkForUpdate() {
    try {
      const remoteVersion = await fetchRemoteVersion();
      if (!remoteVersion || !appVersion || remoteVersion === appVersion) return;

      reloadOnceForVersion(remoteVersion);
    } catch (_error) {
      // Updateprüfung bleibt bewusst still, damit die Oberfläche nicht stört.
    }
  }

  function startUpdateChecks() {
    consumeUpdateNotice();

    if (window.location.protocol === 'file:') return;

    window.setTimeout(checkForUpdate, initialDelayMs);
    window.setInterval(checkForUpdate, intervalMs);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startUpdateChecks, { once: true });
  } else {
    startUpdateChecks();
  }
})(window);

(function (window, document) {
  'use strict';

  const UwUBooks = window.UwUBooks || {};
  const APP_CONFIG = UwUBooks.APP_CONFIG || {};
  const firebaseConfig = APP_CONFIG.firebase || {};
  const storage = UwUBooks.storage;
  const ui = UwUBooks.ui;

  const state = {
    shareId: '',
    mode: '',
    editKey: '',
    editKeyHash: '',
    remoteUpdatedAt: '',
    pollingTimer: 0,
    pushTimer: 0,
    applyingRemote: false,
    shareReady: false,
  };

  const modal = createShareModal();
  document.body.appendChild(modal.backdrop);

  function isConfigured() {
    return Boolean(firebaseConfig.enabled && firebaseConfig.databaseUrl);
  }

  function databaseBaseUrl() {
    return String(firebaseConfig.databaseUrl || '').replace(/\/+$/, '');
  }

  function sharePath(id) {
    const basePath = String(firebaseConfig.sharePath || 'uwuBooksShares').replace(/^\/+|\/+$/g, '');
    return `${databaseBaseUrl()}/${encodeURIComponent(basePath)}/${encodeURIComponent(id)}.json`;
  }

  function randomToken(bytes = 18) {
    const array = new Uint8Array(bytes);
    crypto.getRandomValues(array);
    return Array.from(array, (value) => value.toString(16).padStart(2, '0')).join('');
  }

  async function sha256(text) {
    const data = new TextEncoder().encode(String(text || ''));
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, '0')).join('');
  }

  function currentUrlWithParams(params) {
    const url = new URL(window.location.href);
    ['share', 'mode', 'key', 'uwuUpdated', '_'].forEach((name) => url.searchParams.delete(name));
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
    return url.toString();
  }

  function readUrlState() {
    const url = new URL(window.location.href);
    return {
      shareId: String(url.searchParams.get('share') || '').trim(),
      mode: String(url.searchParams.get('mode') || '').trim().toLowerCase(),
      editKey: String(url.searchParams.get('key') || '').trim(),
    };
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      throw new Error('Firebase ist gerade nicht erreichbar.');
    }

    return response.json();
  }

  function getLocalEntries() {
    return UwUBooks.app && typeof UwUBooks.app.getEntries === 'function'
      ? UwUBooks.app.getEntries()
      : [];
  }

  function applyRemoteEntries(entries) {
    if (!UwUBooks.app || typeof UwUBooks.app.applyEntriesFromShare !== 'function') return;
    state.applyingRemote = true;
    UwUBooks.app.applyEntriesFromShare(Array.isArray(entries) ? entries : []);
    window.setTimeout(() => { state.applyingRemote = false; }, 0);
  }

  function setReadOnlyMode(enabled) {
    if (UwUBooks.app && typeof UwUBooks.app.setReadOnlyMode === 'function') {
      UwUBooks.app.setReadOnlyMode(Boolean(enabled));
    }
  }

  function updateModalText() {
    if (!isConfigured()) {
      modal.status.textContent = 'Firebase ist noch nicht eingerichtet. Trage zuerst die Datenbank-URL in js/config.js ein.';
      modal.createBtn.disabled = true;
      modal.linksWrap.hidden = true;
      return;
    }

    modal.createBtn.disabled = false;
    if (state.shareId) {
      modal.status.textContent = state.mode === 'view'
        ? 'Du nutzt gerade eine geteilte Liste zum Anschauen.'
        : 'Du nutzt gerade eine geteilte Liste mit Bearbeitung.';
    } else {
      modal.status.textContent = 'Erstelle eine geteilte Liste und kopiere danach den passenden Link.';
    }
  }

  function setLinks(shareId, editKey) {
    const editLink = currentUrlWithParams({ share: shareId, mode: 'edit', key: editKey });
    const viewLink = currentUrlWithParams({ share: shareId, mode: 'view' });
    modal.editLink.value = editLink;
    modal.viewLink.value = viewLink;
    modal.linksWrap.hidden = false;
  }

  function openShareModal() {
    updateModalText();
    if (state.shareId) {
      setLinks(state.shareId, state.editKey || '');
      if (!state.editKey) modal.editLink.value = 'Nur beim Erstellen oder mit Bearbeitungslink sichtbar.';
    }
    modal.backdrop.hidden = false;
    modal.backdrop.classList.remove('is-leaving');
    modal.backdrop.classList.add('is-visible');
    modal.closeBtn.focus({ preventScroll: true });
  }

  function closeShareModal() {
    modal.backdrop.classList.add('is-leaving');
    modal.backdrop.classList.remove('is-visible');
    window.setTimeout(() => {
      modal.backdrop.hidden = true;
      modal.backdrop.classList.remove('is-leaving');
    }, 180);
  }

  function createShareModal() {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop share-modal-backdrop';
    backdrop.hidden = true;

    const dialog = document.createElement('article');
    dialog.className = 'share-modal';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'shareTitle');

    const title = document.createElement('h3');
    title.id = 'shareTitle';
    title.textContent = 'Geteilte Liste';

    const text = document.createElement('p');
    text.className = 'share-modal__text';
    text.textContent = 'Teile die Bücherliste mit anderen. Der Bearbeitungslink darf nur an Personen gehen, die Änderungen machen sollen.';

    const status = document.createElement('p');
    status.className = 'share-status';

    const createBtn = document.createElement('button');
    createBtn.className = 'primary-button';
    createBtn.type = 'button';
    createBtn.textContent = 'Geteilte Liste erstellen';

    const linksWrap = document.createElement('div');
    linksWrap.className = 'share-links';
    linksWrap.hidden = true;

    const editLink = createLinkField('Bearbeitungslink');
    const viewLink = createLinkField('Ansichtslink');

    linksWrap.append(editLink.wrap, viewLink.wrap);

    const actions = document.createElement('div');
    actions.className = 'confirm-modal__actions share-modal__actions';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'secondary-button';
    closeBtn.type = 'button';
    closeBtn.textContent = 'Schließen';

    actions.append(createBtn, closeBtn);
    dialog.append(title, text, status, linksWrap, actions);
    backdrop.appendChild(dialog);

    closeBtn.addEventListener('click', closeShareModal);
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) closeShareModal();
    });
    createBtn.addEventListener('click', createShare);

    return {
      backdrop,
      status,
      createBtn,
      linksWrap,
      editLink: editLink.input,
      viewLink: viewLink.input,
      closeBtn,
    };
  }

  function createLinkField(labelText) {
    const wrap = document.createElement('label');
    wrap.className = 'share-link-field';

    const label = document.createElement('span');
    label.textContent = labelText;

    const row = document.createElement('div');
    row.className = 'share-link-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.readOnly = true;

    const button = document.createElement('button');
    button.className = 'ghost-button compact-button';
    button.type = 'button';
    button.textContent = 'Kopieren';

    button.addEventListener('click', () => copyText(input.value));

    row.append(input, button);
    wrap.append(label, row);

    return { wrap, input };
  }

  async function copyText(text) {
    if (!text || text.startsWith('Nur beim')) return;
    try {
      await navigator.clipboard.writeText(text);
      ui.showToast('Link kopiert', 'Der Link wurde in die Zwischenablage kopiert.');
    } catch (_error) {
      ui.showToast('Kopieren nicht möglich', 'Markiere den Link bitte manuell und kopiere ihn selbst.', 'error');
    }
  }

  function buildPayload(entries, editKeyHash) {
    return {
      app: 'UwU Books',
      version: APP_CONFIG.appVersion || '1',
      entries,
      editKeyHash,
      updatedAt: new Date().toISOString(),
    };
  }

  async function createShare() {
    if (!isConfigured()) {
      ui.showToast('Firebase fehlt', 'Trage zuerst die Firebase-Datenbank-URL in js/config.js ein.', 'error');
      return;
    }

    modal.createBtn.disabled = true;
    modal.createBtn.textContent = 'Wird erstellt …';

    try {
      const shareId = randomToken(12);
      const editKey = randomToken(18);
      const editKeyHash = await sha256(editKey);
      const payload = buildPayload(getLocalEntries(), editKeyHash);

      await requestJson(sharePath(shareId), {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      state.shareId = shareId;
      state.mode = 'edit';
      state.editKey = editKey;
      state.editKeyHash = editKeyHash;
      state.remoteUpdatedAt = payload.updatedAt;
      state.shareReady = true;

      setLinks(shareId, editKey);
      updateModalText();
      startPolling();
      setReadOnlyMode(false);
      ui.showToast('Geteilte Liste erstellt', 'Du kannst den Bearbeitungslink oder Ansichtslink jetzt weitergeben.');
    } catch (_error) {
      ui.showToast('Teilen nicht möglich', 'Die geteilte Liste konnte gerade nicht erstellt werden. Prüfe bitte die Firebase-Einstellungen.', 'error');
    } finally {
      modal.createBtn.disabled = false;
      modal.createBtn.textContent = 'Neue geteilte Liste erstellen';
    }
  }

  async function loadSharedListFromUrl() {
    const urlState = readUrlState();
    if (!urlState.shareId) return;

    state.shareId = urlState.shareId;
    state.mode = urlState.mode === 'edit' && urlState.editKey ? 'edit' : 'view';
    state.editKey = state.mode === 'edit' ? urlState.editKey : '';

    if (!isConfigured()) {
      ui.showToast('Firebase fehlt', 'Diese geteilte Liste kann erst geladen werden, wenn Firebase in js/config.js eingerichtet ist.', 'error');
      setReadOnlyMode(true);
      return;
    }

    try {
      const remote = await requestJson(sharePath(state.shareId));
      if (!remote || !Array.isArray(remote.entries)) {
        ui.showToast('Liste nicht gefunden', 'Der geteilte Link passt zu keiner Liste.', 'error');
        return;
      }

      state.editKeyHash = String(remote.editKeyHash || '');
      state.remoteUpdatedAt = String(remote.updatedAt || '');
      state.shareReady = true;

      if (state.mode === 'edit') {
        const hash = await sha256(state.editKey);
        if (hash !== state.editKeyHash) {
          state.mode = 'view';
          state.editKey = '';
          ui.showToast('Nur Ansicht', 'Der Bearbeitungslink passt nicht. Die Liste wurde zum Anschauen geöffnet.', 'error');
        }
      }

      applyRemoteEntries(remote.entries);
      setReadOnlyMode(state.mode !== 'edit');
      startPolling();

      ui.showToast(
        state.mode === 'edit' ? 'Geteilte Liste geladen' : 'Ansicht geöffnet',
        state.mode === 'edit' ? 'Änderungen werden automatisch abgeglichen.' : 'Diese Liste ist nur zum Anschauen.'
      );
    } catch (_error) {
      ui.showToast('Liste nicht geladen', 'Die geteilte Liste konnte gerade nicht geladen werden.', 'error');
    }
  }

  async function pullRemote() {
    if (!state.shareReady || !state.shareId || !isConfigured()) return;

    try {
      const remote = await requestJson(sharePath(state.shareId));
      if (!remote || !Array.isArray(remote.entries)) return;

      const updatedAt = String(remote.updatedAt || '');
      if (updatedAt && updatedAt !== state.remoteUpdatedAt) {
        state.remoteUpdatedAt = updatedAt;
        applyRemoteEntries(remote.entries);
        ui.showToast('Liste aktualisiert', 'Neue Änderungen wurden übernommen.');
      }
    } catch (_error) {
      // Ruhig bleiben, beim nächsten Intervall wird erneut geprüft.
    }
  }

  function startPolling() {
    window.clearInterval(state.pollingTimer);
    state.pollingTimer = window.setInterval(pullRemote, Number(firebaseConfig.syncIntervalMs || 5000));
  }

  function schedulePush() {
    if (state.applyingRemote || state.mode !== 'edit' || !state.shareReady || !state.shareId || !state.editKeyHash) return;

    window.clearTimeout(state.pushTimer);
    state.pushTimer = window.setTimeout(pushLocalEntries, Number(firebaseConfig.pushDebounceMs || 900));
  }

  async function pushLocalEntries() {
    if (state.mode !== 'edit' || !state.shareReady) return;

    try {
      const payload = buildPayload(getLocalEntries(), state.editKeyHash);
      await requestJson(sharePath(state.shareId), {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      state.remoteUpdatedAt = payload.updatedAt;
    } catch (_error) {
      ui.showToast('Nicht abgeglichen', 'Die Änderung konnte gerade nicht in die geteilte Liste übernommen werden.', 'error');
    }
  }

  function init() {
    const shareBtn = document.querySelector('#shareBtn');
    if (shareBtn) shareBtn.addEventListener('click', openShareModal);

    document.addEventListener('uwu-books:entries-changed', schedulePush);
    loadSharedListFromUrl();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(window, document);

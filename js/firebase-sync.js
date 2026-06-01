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
    remoteEtag: '',
    pollingTimer: 0,
    pushTimer: 0,
    applyingRemote: false,
    shareReady: false,
  };
  const SHARE_ID_RE = /^[0-9a-f]{24}$/;
  const EDIT_KEY_RE = /^[0-9a-f]{36}$/;
  const EDIT_KEY_SESSION_PREFIX = 'uwu-books.share-edit-key.';

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

  function isValidShareId(value) {
    return SHARE_ID_RE.test(String(value || ''));
  }

  function isValidEditKey(value) {
    return EDIT_KEY_RE.test(String(value || ''));
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

  function currentUrlWithParams(params, fragmentParams = {}) {
    const url = new URL(window.location.href);
    ['share', 'mode', 'key', 'uwuUpdated', '_'].forEach((name) => url.searchParams.delete(name));
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
    const hashParams = new URLSearchParams();
    Object.entries(fragmentParams).forEach(([key, value]) => {
      if (value) hashParams.set(key, value);
    });
    const hash = hashParams.toString();
    url.hash = hash ? `#${hash}` : '';
    return url.toString();
  }

  function editKeySessionKey(shareId) {
    return `${EDIT_KEY_SESSION_PREFIX}${shareId}`;
  }

  function rememberEditKey(shareId, editKey) {
    if (!isValidShareId(shareId) || !isValidEditKey(editKey)) return;
    try {
      sessionStorage.setItem(editKeySessionKey(shareId), editKey);
    } catch (_error) {
      // Session storage is a convenience only; the in-memory key still works.
    }
  }

  function readRememberedEditKey(shareId) {
    try {
      const remembered = sessionStorage.getItem(editKeySessionKey(shareId));
      return isValidEditKey(remembered) ? remembered : '';
    } catch (_error) {
      return '';
    }
  }

  function scrubSensitiveUrlParams() {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    const hadKey = url.searchParams.has('key') || hashParams.has('key');
    url.searchParams.delete('key');
    hashParams.delete('key');
    const hash = hashParams.toString();
    url.hash = hash ? `#${hash}` : '';
    if (hadKey && window.history && typeof window.history.replaceState === 'function') {
      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    }
  }

  function readUrlState() {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    const shareId = String(url.searchParams.get('share') || '').trim().toLowerCase();
    const keyFromUrl = String(hashParams.get('key') || url.searchParams.get('key') || '').trim().toLowerCase();
    const editKey = isValidEditKey(keyFromUrl) ? keyFromUrl : readRememberedEditKey(shareId);
    if (isValidEditKey(keyFromUrl)) rememberEditKey(shareId, keyFromUrl);
    scrubSensitiveUrlParams();
    return {
      shareId,
      mode: String(url.searchParams.get('mode') || '').trim().toLowerCase(),
      editKey,
    };
  }

  async function requestJson(url, options = {}) {
    const { includeMeta = false, headers = {}, ...fetchOptions } = options;
    const response = await fetch(url, {
      ...fetchOptions,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        ...headers,
      },
    });

    if (!response.ok) {
      const error = new Error('Firebase ist gerade nicht erreichbar.');
      error.status = response.status;
      throw error;
    }

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (includeMeta) {
      return {
        data,
        etag: String(response.headers.get('ETag') || '').replace(/^"|"$/g, ''),
      };
    }
    return data;
  }

  function getLocalEntries() {
    return UwUBooks.app && typeof UwUBooks.app.getEntries === 'function'
      ? UwUBooks.app.getEntries()
      : [];
  }

  function applyRemoteEntries(entries) {
    if (!UwUBooks.app || typeof UwUBooks.app.applyEntriesFromShare !== 'function') return;
    state.applyingRemote = true;
    UwUBooks.app.applyEntriesFromShare(Array.isArray(entries) ? entries : [], { persist: false });
    window.setTimeout(() => { state.applyingRemote = false; }, 0);
  }

  function setSharedSessionMode(enabled) {
    if (UwUBooks.app && typeof UwUBooks.app.setSharedSessionMode === 'function') {
      UwUBooks.app.setSharedSessionMode(Boolean(enabled));
    }
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
    const editLink = currentUrlWithParams({ share: shareId, mode: 'edit' }, { key: editKey });
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

    modal.backdrop.classList.remove('is-closing');
    modal.backdrop.hidden = false;
    modal.closeBtn.focus({ preventScroll: true });
  }

  function closeShareModal() {
    if (modal.backdrop.hidden || modal.backdrop.classList.contains('is-closing')) return;

    modal.backdrop.classList.add('is-closing');

    const finishClose = () => {
      modal.backdrop.hidden = true;
      modal.backdrop.classList.remove('is-closing');
    };

    modal.backdrop.addEventListener('animationend', finishClose, { once: true });
    window.setTimeout(finishClose, 260);
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

    const warning = document.createElement('p');
    warning.className = 'share-warning';
    warning.textContent = 'Behandle den Bearbeitungslink wie ein Passwort. Der Ansichtslink ist zum Mitlesen gedacht.';

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
    dialog.append(title, text, warning, status, linksWrap, actions);
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

      const created = await requestJson(sharePath(shareId), {
        method: 'PUT',
        body: JSON.stringify(payload),
        includeMeta: true,
      });

      state.shareId = shareId;
      state.mode = 'edit';
      state.editKey = editKey;
      state.editKeyHash = editKeyHash;
      state.remoteUpdatedAt = payload.updatedAt;
      state.remoteEtag = created.etag || '';
      state.shareReady = true;

      rememberEditKey(shareId, editKey);
      setLinks(shareId, editKey);
      updateModalText();
      startPolling();
      setSharedSessionMode(true);
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
    if (!isValidShareId(urlState.shareId)) {
      ui.showToast('Geteilter Link ungÃ¼ltig', 'Dieser Link passt nicht zu einer UwU-Books-Liste.', 'error');
      setReadOnlyMode(true);
      return;
    }

    state.shareId = urlState.shareId;
    state.mode = urlState.mode === 'edit' && urlState.editKey ? 'edit' : 'view';
    state.editKey = state.mode === 'edit' ? urlState.editKey : '';

    if (!isConfigured()) {
      ui.showToast('Firebase fehlt', 'Diese geteilte Liste kann erst geladen werden, wenn Firebase in js/config.js eingerichtet ist.', 'error');
      setReadOnlyMode(true);
      return;
    }

    try {
      const pulled = await requestJson(sharePath(state.shareId), {
        includeMeta: true,
        headers: { 'X-Firebase-ETag': 'true' },
      });
      const remote = pulled.data;
      if (!remote || !Array.isArray(remote.entries)) {
        ui.showToast('Liste nicht gefunden', 'Der geteilte Link passt zu keiner Liste.', 'error');
        return;
      }

      state.editKeyHash = String(remote.editKeyHash || '');
      state.remoteUpdatedAt = String(remote.updatedAt || '');
      state.remoteEtag = pulled.etag || '';
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
      setSharedSessionMode(true);
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
      const pulled = await requestJson(sharePath(state.shareId), {
        includeMeta: true,
        headers: { 'X-Firebase-ETag': 'true' },
      });
      const remote = pulled.data;
      if (!remote || !Array.isArray(remote.entries)) return;

      const updatedAt = String(remote.updatedAt || '');
      if (updatedAt && updatedAt !== state.remoteUpdatedAt) {
        state.remoteUpdatedAt = updatedAt;
        state.remoteEtag = pulled.etag || '';
        applyRemoteEntries(remote.entries);
        ui.showToast('Liste aktualisiert', 'Neue Änderungen wurden übernommen.');
      } else if (pulled.etag) {
        state.remoteEtag = pulled.etag;
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
      const headers = state.remoteEtag ? { 'If-Match': state.remoteEtag } : {};
      const pushed = await requestJson(sharePath(state.shareId), {
        method: 'PUT',
        body: JSON.stringify(payload),
        headers,
        includeMeta: true,
      });
      state.remoteUpdatedAt = payload.updatedAt;
      state.remoteEtag = pushed.etag || '';
    } catch (error) {
      if (error.status === 412) {
        await pullRemote();
        ui.showToast('Konflikt erkannt', 'Die Liste wurde woanders geändert. Bitte prüfe die aktuelle Version und speichere deine Änderung erneut.', 'error');
        return;
      }
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

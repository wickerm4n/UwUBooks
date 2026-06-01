(function (window) {
  'use strict';

  const UwUBooks = window.UwUBooks;
  const APP_CONFIG = UwUBooks.APP_CONFIG;
  const {
    loadEntries,
    saveEntries,
    createEntryId,
    downloadTextFile,
    toCsv,
    normalizeEntry,
    entrySignature,
    validateAndNormalizeEntries,
    parseJsonImport,
  } = UwUBooks.storage;
  const {
    selectors,
    readForm,
    resetForm,
    fillForm,
    renderEntries,
    updateStats,
    setEditorialToggle,
    showToast,
    confirmDialog,
    resetSkippedConfirmations,
    updateConfirmationResetVisibility,
  } = UwUBooks.ui;

  let entries = loadEntries();
  let selectedEntryIds = new Set();
  let renderTimer = 0;
  let readOnlyMode = false;
  let sharedSessionMode = false;

  function notifyEntriesChanged(source = 'local') {
    document.dispatchEvent(new CustomEvent('uwu-books:entries-changed', {
      detail: { source, count: entries.length },
    }));
  }

  function persistAndRender(options = {}) {
    if (!sharedSessionMode && !saveEntries(entries)) {
      showToast('Konnte nicht gespeichert werden', 'Der Browser konnte die Liste gerade nicht speichern. Prüfe bitte, ob Speicherplatz frei ist oder ein privates Fenster genutzt wird.', 'error');
      return false;
    }
    render();
    if (options.notify !== false) notifyEntriesChanged(options.source || 'local');
    return true;
  }

  function blockWriteWhenReadOnly() {
    if (!readOnlyMode) return false;
    showToast('Nur zum Anschauen', 'Dieser geteilte Link kann nicht bearbeitet werden.', 'error');
    return true;
  }

  function normalizeSearch(value) {
    return String(value || '').normalize('NFC').trim().toLowerCase();
  }

  function getFilteredEntries() {
    const query = normalizeSearch(selectors.searchInput.value);

    return entries.filter((entry) => {
      const haystack = normalizeSearch([
        entry.firstName,
        entry.lastName,
        entry.phone,
        entry.accountData,
        entry.bookTitle,
        entry.submittedDate,
        entry.publishedDate,
        entry.inEditorial,
        entry.takenBy,
        entry.pseudonym,
        entry.notes,
      ].join(' '));
      return !query || haystack.includes(query);
    }).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }

  function cleanupSelection() {
    const validIds = new Set(entries.map((entry) => entry.id));
    selectedEntryIds = new Set([...selectedEntryIds].filter((id) => validIds.has(id)));
  }

  function getSelectedEntries() {
    return entries.filter((entry) => selectedEntryIds.has(entry.id));
  }

  function updateBulkControls(filteredEntries = getFilteredEntries()) {
    cleanupSelection();
    const selectedEntries = getSelectedEntries();
    const selectedCount = selectedEntries.length;
    const visibleIds = filteredEntries.map((entry) => entry.id);
    const visibleSelectedCount = visibleIds.filter((id) => selectedEntryIds.has(id)).length;

    selectors.bulkToolbar.hidden = selectedCount === 0;
    selectors.bulkCount.textContent = selectedCount === 1 ? '1 Eintrag ausgewählt' : `${selectedCount} Einträge ausgewählt`;
    selectors.deleteSelectedBtn.disabled = selectedCount === 0;
    selectors.bulkExportJsonBtn.disabled = selectedCount === 0;
    selectors.bulkExportCsvBtn.disabled = selectedCount === 0;

    selectors.selectVisibleCheckbox.disabled = visibleIds.length === 0;
    selectors.selectVisibleCheckbox.checked = visibleIds.length > 0 && visibleSelectedCount === visibleIds.length;
    selectors.selectVisibleCheckbox.indeterminate = visibleSelectedCount > 0 && visibleSelectedCount < visibleIds.length;
  }

  function render() {
    cleanupSelection();
    const filtered = getFilteredEntries();
    renderEntries(filtered, selectedEntryIds);
    updateStats(entries);
    updateBulkControls(filtered);
    updateReadOnlyActionButtons();
  }

  function scheduleRender() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(render, 120);
  }

  function editEntry(id) {
    if (blockWriteWhenReadOnly()) return;
    const entry = entries.find((item) => item.id === id);
    if (!entry) {
      showToast('Eintrag nicht mehr da', 'Dieser Eintrag ist nicht mehr in der Liste.', 'error');
      return;
    }
    fillForm(entry);
  }

  function previewForEntry(entry) {
    return [{
      title: entry.bookTitle || 'Ohne Titel',
      subtitle: `${entry.firstName} ${entry.lastName}${entry.pseudonym ? ` · ${entry.pseudonym}` : ''}`.trim(),
    }];
  }

  async function deleteEntry(id) {
    if (blockWriteWhenReadOnly()) return;
    const entry = entries.find((item) => item.id === id);
    if (!entry) return;

    const confirmed = await confirmDialog({
      title: 'Eintrag löschen?',
      message: 'Diesen Eintrag aus der Liste löschen?',
      confirmText: 'Löschen',
      previewItems: previewForEntry(entry),
      skipKey: 'delete-entry',
    });

    if (!confirmed) return;
    entries = entries.filter((item) => item.id !== id);
    selectedEntryIds.delete(id);
    if (selectors.entryId.value === id) resetForm();
    if (persistAndRender()) showToast('Eintrag gelöscht', entry.bookTitle);
  }

  async function deleteSelectedEntries() {
    if (blockWriteWhenReadOnly()) return;
    const selected = getSelectedEntries();
    if (!selected.length) {
      showToast('Nichts ausgewählt', 'Wähle zuerst einen oder mehrere Einträge aus.');
      return;
    }

    const previewItems = selected.slice(0, 6).map((entry) => ({
      title: entry.bookTitle || 'Ohne Titel',
      subtitle: `${entry.firstName} ${entry.lastName}${entry.pseudonym ? ` · ${entry.pseudonym}` : ''}`.trim(),
    }));
    if (selected.length > 6) {
      previewItems.push({ kind: 'more', title: `… und ${selected.length - 6} weitere Einträge` });
    }

    const confirmed = await confirmDialog({
      title: 'Auswahl löschen?',
      message: selected.length === 1
        ? 'Den ausgewählten Eintrag aus der Liste löschen?'
        : `Diese ${selected.length} ausgewählten Einträge aus der Liste löschen?`,
      confirmText: 'Auswahl löschen',
      previewItems,
      skipKey: 'delete-selected',
    });

    if (!confirmed) return;
    const removedIds = new Set(selected.map((entry) => entry.id));
    entries = entries.filter((entry) => !removedIds.has(entry.id));
    selectedEntryIds = new Set();
    if (removedIds.has(selectors.entryId.value)) resetForm();
    if (persistAndRender()) showToast('Auswahl gelöscht', selected.length === 1 ? '1 Eintrag wurde gelöscht.' : `${selected.length} Einträge wurden gelöscht.`);
  }

  async function deleteAllEntries() {
    if (blockWriteWhenReadOnly()) return;
    if (!entries.length) {
      showToast('Keine Einträge', 'Die Liste ist bereits leer.');
      return;
    }

    const previewItems = entries.slice(0, 6).map((entry) => ({
      title: entry.bookTitle || 'Ohne Titel',
      subtitle: `${entry.firstName} ${entry.lastName}`.trim(),
    }));
    if (entries.length > 6) {
      previewItems.push({ kind: 'more', title: `… und ${entries.length - 6} weitere Einträge` });
    }

    const confirmed = await confirmDialog({
      title: 'Liste leeren?',
      message: `Alle ${entries.length} Einträge aus der Liste löschen?`,
      confirmText: 'Liste leeren',
      previewItems,
      skipKey: 'delete-all',
    });

    if (!confirmed) return;
    entries = [];
    selectedEntryIds = new Set();
    resetForm();
    if (persistAndRender()) showToast('Liste geleert', 'Die Liste ist jetzt leer.');
  }

  function saveForm(event) {
    event.preventDefault();
    if (blockWriteWhenReadOnly()) return;

    if (entries.length >= APP_CONFIG.maxEntries && !selectors.entryId.value) {
      showToast('Liste ist voll', `Es können bis zu ${APP_CONFIG.maxEntries} Einträge gespeichert werden.`, 'error');
      return;
    }

    const now = new Date().toISOString();
    let formData;
    try {
      formData = normalizeEntry({
        ...readForm(),
        id: selectors.entryId.value || createEntryId(),
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      showToast('Eingaben prüfen', error.message || 'Bitte prüfe die Angaben und versuche es erneut.', 'error');
      return;
    }

    if (selectors.entryId.value) {
      const oldEntry = entries.find((entry) => entry.id === selectors.entryId.value);
      entries = entries.map((entry) => entry.id === selectors.entryId.value ? {
        ...formData,
        createdAt: oldEntry?.createdAt || now,
        updatedAt: now,
      } : entry);
      if (persistAndRender()) showToast('Eintrag aktualisiert', formData.bookTitle);
    } else {
      entries = [{ ...formData, createdAt: now, updatedAt: now }, ...entries];
      if (persistAndRender()) showToast('Eintrag gespeichert', formData.bookTitle);
    }

    resetForm();
  }

  function exportJson() {
    const stamp = new Date().toISOString().slice(0, 10);
    const payload = {
      app: APP_CONFIG.appName,
      schemaVersion: 4,
      exportedAt: new Date().toISOString(),
      entries,
    };
    downloadTextFile(`${APP_CONFIG.exportFileBase}-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    showToast('Sicherung gespeichert', `${entries.length} Einträge wurden als Sicherung heruntergeladen.`);
  }

  function exportCsv() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`${APP_CONFIG.exportFileBase}-${stamp}.csv`, `\uFEFF${toCsv(entries)}`, 'text/csv;charset=utf-8');
    showToast('Tabelle gespeichert', `${entries.length} Einträge wurden als Tabelle heruntergeladen.`);
  }

  function exportSelectedJson() {
    const selected = getSelectedEntries();
    if (!selected.length) {
      showToast('Nichts ausgewählt', 'Wähle zuerst einen oder mehrere Einträge aus.');
      return;
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const payload = {
      app: APP_CONFIG.appName,
      schemaVersion: 4,
      exportedAt: new Date().toISOString(),
      exportedSelection: true,
      entries: selected,
    };
    downloadTextFile(`${APP_CONFIG.exportFileBase}-auswahl-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    showToast('Auswahl gespeichert', selected.length === 1 ? '1 Eintrag wurde als Sicherung heruntergeladen.' : `${selected.length} Einträge wurden als Sicherung heruntergeladen.`);
  }

  function exportSelectedCsv() {
    const selected = getSelectedEntries();
    if (!selected.length) {
      showToast('Nichts ausgewählt', 'Wähle zuerst einen oder mehrere Einträge aus.');
      return;
    }

    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`${APP_CONFIG.exportFileBase}-auswahl-${stamp}.csv`, `\uFEFF${toCsv(selected)}`, 'text/csv;charset=utf-8');
    showToast('Auswahl gespeichert', selected.length === 1 ? '1 Eintrag wurde als Tabelle heruntergeladen.' : `${selected.length} Einträge wurden als Tabelle heruntergeladen.`);
  }

  function validateImportFile(file) {
    const name = String(file.name || '').toLowerCase();
    const type = String(file.type || '').toLowerCase();
    if (!name.endsWith('.json') && type !== 'application/json') {
      throw new Error('Bitte wähle eine JSON-Sicherung aus UwU Books.');
    }
    if (file.size > APP_CONFIG.maxImportBytes) {
      throw new Error(`Diese Sicherung ist zu groß. Bitte nutze eine Datei mit höchstens ${Math.round(APP_CONFIG.maxImportBytes / 1024 / 1024)} MB.`);
    }
  }

  function readFileAsText(file) {
    if (typeof file.text === 'function') {
      return file.text();
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(String(reader.result || '')), { once: true });
      reader.addEventListener('error', () => reject(new Error('Die Sicherung konnte nicht geöffnet werden.')), { once: true });
      reader.addEventListener('abort', () => reject(new Error('Das Einspielen wurde abgebrochen.')), { once: true });
      reader.readAsText(file, 'utf-8');
    });
  }

  async function importJson(event) {
    if (blockWriteWhenReadOnly()) {
      event.target.value = '';
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      validateImportFile(file);
      const text = await readFileAsText(file);
      const parsed = parseJsonImport(text);
      const result = validateAndNormalizeEntries(parsed, {
        knownSignatures: entries.map(entrySignature),
        knownIds: entries.map((entry) => entry.id),
        dedupe: true,
        strict: true,
      });

      if (!result.entries.length) {
        const skipped = result.skippedInvalid + result.skippedDuplicates;
        throw new Error(skipped ? 'In dieser Sicherung wurden keine neuen passenden Einträge gefunden.' : 'Diese Sicherung enthält keine Einträge.');
      }

      if (entries.length + result.entries.length > APP_CONFIG.maxEntries) {
        throw new Error(`Danach wäre die Liste zu voll. Aktuell: ${entries.length}, neu: ${result.entries.length}, möglich: ${APP_CONFIG.maxEntries}.`);
      }

      const infoParts = [`${result.entries.length} neue Einträge gefunden.`];
      if (result.skippedDuplicates) infoParts.push(`${result.skippedDuplicates} waren schon vorhanden.`);
      if (result.skippedInvalid) infoParts.push(`${result.skippedInvalid} wurden übersprungen.`);

      const previewItems = result.entries.slice(0, 5).map((entry) => ({
        title: entry.bookTitle || 'Ohne Titel',
        subtitle: `${entry.firstName} ${entry.lastName}`.trim(),
      }));
      if (result.entries.length > 5) {
        previewItems.push({ kind: 'more', title: `… und ${result.entries.length - 5} weitere neue Einträge` });
      }

      const confirmed = await confirmDialog({
        title: 'Sicherung einspielen?',
        message: infoParts.join(' '),
        confirmText: 'Einspielen',
        previewItems,
        skipKey: 'import-json',
      });

      if (!confirmed) return;
      entries = [...result.entries, ...entries];
      if (persistAndRender()) {
        showToast('Sicherung eingespielt', `${result.entries.length} Einträge wurden hinzugefügt.`);
      }
    } catch (error) {
      showToast('Sicherung nicht eingespielt', error.message || 'Die Sicherung konnte nicht gelesen werden.', 'error');
    } finally {
      selectors.importJsonInput.value = '';
    }
  }

  const PHONE_ALLOWED_RE = /^[0-9+\-()\s]*$/;

  function cleanPhoneValue(value) {
    return String(value || '').replace(/[^0-9+\-()\s]/g, '').replace(/\s{2,}/g, ' ').slice(0, APP_CONFIG.fieldLimits.phone || 24);
  }

  function enforcePhoneInput() {
    const cleaned = cleanPhoneValue(selectors.phone.value);
    if (selectors.phone.value !== cleaned) selectors.phone.value = cleaned;
  }

  function blockInvalidPhoneInput(event) {
    if (event.isComposing || typeof event.data !== 'string' || event.data === '') return;
    if (!PHONE_ALLOWED_RE.test(event.data)) event.preventDefault();
  }

  function handlePhonePaste(event) {
    const pastedText = event.clipboardData?.getData('text');
    if (!pastedText) return;
    const cleaned = cleanPhoneValue(pastedText);
    if (cleaned === pastedText) return;

    event.preventDefault();
    const input = selectors.phone;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const nextValue = cleanPhoneValue(`${input.value.slice(0, start)}${cleaned}${input.value.slice(end)}`);
    input.value = nextValue;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function handleTableClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button || !selectors.tbody.contains(button)) return;
    const row = button.closest('tr[data-entry-id]');
    const id = row?.dataset.entryId;
    if (!id) return;
    switch (button.dataset.action) {
      case 'edit':
        editEntry(id);
        break;
      case 'delete':
        deleteEntry(id);
        break;
      default:
        break;
    }
  }

  function handleTableSelection(event) {
    const checkbox = event.target.closest('input[data-action="select-entry"]');
    if (!checkbox || !selectors.tbody.contains(checkbox)) return;
    const row = checkbox.closest('tr[data-entry-id]');
    const id = row?.dataset.entryId;
    if (!id) return;

    if (checkbox.checked) selectedEntryIds.add(id);
    else selectedEntryIds.delete(id);

    row.classList.toggle('is-selected', checkbox.checked);
    updateBulkControls();
  }

  function toggleVisibleSelection() {
    const filtered = getFilteredEntries();
    const shouldSelect = selectors.selectVisibleCheckbox.checked;
    filtered.forEach((entry) => {
      if (shouldSelect) selectedEntryIds.add(entry.id);
      else selectedEntryIds.delete(entry.id);
    });
    render();
  }


  function getEntriesSnapshot() {
    return entries.map((entry) => ({ ...entry }));
  }

  function applyEntriesFromShare(sharedEntries, options = {}) {
    const result = validateAndNormalizeEntries(sharedEntries, {
      knownSignatures: [],
      knownIds: [],
      dedupe: false,
      strict: false,
    });

    entries = result.entries.slice(0, APP_CONFIG.maxEntries);
    selectedEntryIds = new Set();
    resetForm();
    if (options.persist === true && !sharedSessionMode) saveEntries(entries);
    render();
  }

  function updateReadOnlyActionButtons() {
    selectors.tbody.querySelectorAll('button[data-action="edit"], button[data-action="delete"]').forEach((button) => {
      button.disabled = readOnlyMode;
      button.setAttribute('aria-disabled', String(readOnlyMode));
    });
  }

  function setReadOnlyMode(enabled) {
    readOnlyMode = Boolean(enabled);
    document.documentElement.dataset.shareMode = readOnlyMode ? 'readonly' : 'editable';

    const fields = selectors.form.querySelectorAll('input, select, textarea, button');
    fields.forEach((field) => {
      if (field.id === 'entryId') return;
      field.disabled = readOnlyMode;
    });

    selectors.deleteAllBtn.disabled = readOnlyMode;
    selectors.deleteSelectedBtn.disabled = readOnlyMode;
    selectors.importJsonInput.disabled = readOnlyMode;
    selectors.restoreConfirmBtn.disabled = readOnlyMode;
    render();
  }

  function setSharedSessionMode(enabled) {
    sharedSessionMode = Boolean(enabled);
    document.documentElement.dataset.sharedSession = sharedSessionMode ? 'true' : 'false';
  }

  UwUBooks.app = Object.freeze({
    getEntries: getEntriesSnapshot,
    applyEntriesFromShare,
    setReadOnlyMode,
    setSharedSessionMode,
    isReadOnlyMode: () => readOnlyMode,
  });

  function initEvents() {
    selectors.form.addEventListener('submit', saveForm);
    selectors.resetFormBtn.addEventListener('click', resetForm);
    selectors.deleteAllBtn.addEventListener('click', deleteAllEntries);
    selectors.deleteSelectedBtn.addEventListener('click', deleteSelectedEntries);
    selectors.bulkExportJsonBtn.addEventListener('click', exportSelectedJson);
    selectors.bulkExportCsvBtn.addEventListener('click', exportSelectedCsv);
    selectors.selectVisibleCheckbox.addEventListener('change', toggleVisibleSelection);
    selectors.restoreConfirmBtn.addEventListener('click', () => {
      const restored = resetSkippedConfirmations();
      showToast('Nachfragen sichtbar', restored ? 'Die Nachfragen werden wieder angezeigt.' : 'Die Nachfragen werden bereits angezeigt.');
    });
    selectors.exportJsonBtn.addEventListener('click', exportJson);
    selectors.exportCsvBtn.addEventListener('click', exportCsv);
    selectors.importJsonInput.addEventListener('change', importJson);
    selectors.importJsonInput.closest('.file-button')?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (!selectors.importJsonInput.disabled) selectors.importJsonInput.click();
    });
    selectors.searchInput.addEventListener('input', scheduleRender);
    selectors.phone.addEventListener('beforeinput', blockInvalidPhoneInput);
    selectors.phone.addEventListener('paste', handlePhonePaste);
    selectors.phone.addEventListener('input', enforcePhoneInput);
    selectors.tbody.addEventListener('click', handleTableClick);
    selectors.tbody.addEventListener('change', handleTableSelection);

    selectors.editorialToggle.addEventListener('click', () => {
      const isChecked = selectors.editorialToggle.getAttribute('aria-checked') === 'true';
      setEditorialToggle(!isChecked);
    });
  }

  initEvents();
  resetForm();
  updateConfirmationResetVisibility();
  render();
})(window);

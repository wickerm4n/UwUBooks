(function (window, document) {
  'use strict';

  const UwUBooks = window.UwUBooks = window.UwUBooks || {};
  const APP_CONFIG = UwUBooks.APP_CONFIG;

  const selectors = Object.freeze({
    form: document.querySelector('#bookForm'),
    entryId: document.querySelector('#entryId'),
    firstName: document.querySelector('#firstName'),
    lastName: document.querySelector('#lastName'),
    phone: document.querySelector('#phone'),
    accountData: document.querySelector('#accountData'),
    bookTitle: document.querySelector('#bookTitle'),
    status: document.querySelector('#status'),
    statusDate: document.querySelector('#statusDate'),
    statusDateLabel: document.querySelector('#statusDateLabel'),
    editorialToggle: document.querySelector('#editorialToggle'),
    inEditorial: document.querySelector('#inEditorial'),
    pseudonym: document.querySelector('#pseudonym'),
    notes: document.querySelector('#notes'),
    saveBtn: document.querySelector('#saveBtn'),
    resetFormBtn: document.querySelector('#resetFormBtn'),
    searchInput: document.querySelector('#searchInput'),
    statusFilter: document.querySelector('#statusFilter'),
    tbody: document.querySelector('#entriesTbody'),
    emptyState: document.querySelector('#emptyState'),
    totalCount: document.querySelector('#totalCount'),
    publishedCount: document.querySelector('#publishedCount'),
    editorialCount: document.querySelector('#editorialCount'),
    deleteAllBtn: document.querySelector('#deleteAllBtn'),
    deleteSelectedBtn: document.querySelector('#deleteSelectedBtn'),
    restoreConfirmBtn: document.querySelector('#restoreConfirmBtn'),
    exportJsonBtn: document.querySelector('#exportJsonBtn'),
    exportCsvBtn: document.querySelector('#exportCsvBtn'),
    bulkExportJsonBtn: document.querySelector('#bulkExportJsonBtn'),
    bulkExportCsvBtn: document.querySelector('#bulkExportCsvBtn'),
    bulkToolbar: document.querySelector('#bulkToolbar'),
    bulkCount: document.querySelector('#bulkCount'),
    selectVisibleCheckbox: document.querySelector('#selectVisibleCheckbox'),
    importJsonInput: document.querySelector('#importJsonInput'),
    modalBackdrop: document.querySelector('#modalBackdrop'),
    confirmTitle: document.querySelector('#confirmTitle'),
    confirmMessage: document.querySelector('#confirmMessage'),
    confirmPreview: document.querySelector('#confirmPreview'),
    confirmSkipWrap: document.querySelector('#confirmSkipWrap'),
    confirmSkipCheckbox: document.querySelector('#confirmSkipCheckbox'),
    confirmCancelBtn: document.querySelector('#confirmCancelBtn'),
    confirmOkBtn: document.querySelector('#confirmOkBtn'),
    toastStack: document.querySelector('#toastStack'),
  });

  const icons = Object.freeze({
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.86 3.49a1.67 1.67 0 0 1 2.36 0l1.29 1.29c.65.65.65 1.7 0 2.36L8.47 19.18 4 20l.82-4.47L16.86 3.49Zm-1.42 3.78 1.29 1.29 2.36-2.36-1.29-1.29-2.36 2.36ZM7.4 17.32l7.92-7.92-1.29-1.29-7.92 7.92-.37 1.66 1.66-.37Z"/></svg>',
    delete: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-.8 6h2l.35 9h-2l-.35-9Zm5.25 0h2l-.35 9h-2l.35-9ZM6 9h12l-.74 11.08A2.06 2.06 0 0 1 15.2 22H8.8a2.06 2.06 0 0 1-2.06-1.92L6 9Z"/></svg>',
  });

  function assertSelectors() {
    const missing = Object.entries(selectors)
      .filter(([, node]) => !node)
      .map(([name]) => name);
    if (missing.length) {
      throw new Error('Die Seite konnte nicht vollständig geladen werden. Bitte lade sie neu oder lade die Dateien erneut hoch.');
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return new Intl.DateTimeFormat(APP_CONFIG.dateLocale, {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(date);
  }

  function statusDateLabel(status) {
    if (status === 'Veröffentlicht') return 'Veröffentlicht am';
    if (status === 'Im Lektorat') return 'Im Lektorat seit';
    return 'Abgegeben am';
  }

  function badgeClass(status) {
    if (status === 'Veröffentlicht') return 'badge--published';
    if (status === 'Im Lektorat') return 'badge--editorial';
    return 'badge--given';
  }

  function setEditorialToggle(isActive) {
    const checked = Boolean(isActive);
    selectors.editorialToggle.setAttribute('aria-checked', String(checked));
    selectors.editorialToggle.querySelector('strong').textContent = checked ? 'Ja' : 'Nein';
    selectors.inEditorial.value = checked ? 'Ja' : 'Nein';
  }

  function resetForm() {
    selectors.form.reset();
    selectors.entryId.value = '';
    selectors.statusDate.value = new Date().toISOString().slice(0, 10);
    selectors.status.value = 'Abgegeben';
    selectors.statusDateLabel.textContent = statusDateLabel('Abgegeben');
    setEditorialToggle(false);
    selectors.saveBtn.textContent = 'Eintrag speichern';
    selectors.firstName.focus({ preventScroll: true });
  }

  function fillForm(entry) {
    selectors.entryId.value = entry.id;
    selectors.firstName.value = entry.firstName;
    selectors.lastName.value = entry.lastName;
    selectors.phone.value = entry.phone;
    selectors.accountData.value = entry.accountData;
    selectors.bookTitle.value = entry.bookTitle;
    selectors.status.value = entry.status;
    selectors.statusDate.value = entry.statusDate;
    selectors.statusDateLabel.textContent = statusDateLabel(entry.status);
    setEditorialToggle(entry.inEditorial === 'Ja');
    selectors.pseudonym.value = entry.pseudonym;
    selectors.notes.value = entry.notes;
    selectors.saveBtn.textContent = 'Änderungen speichern';
    selectors.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function readForm() {
    return {
      id: selectors.entryId.value,
      firstName: selectors.firstName.value,
      lastName: selectors.lastName.value,
      phone: selectors.phone.value,
      accountData: selectors.accountData.value,
      bookTitle: selectors.bookTitle.value,
      status: selectors.status.value,
      statusDate: selectors.statusDate.value,
      inEditorial: selectors.inEditorial.value,
      pseudonym: selectors.pseudonym.value,
      notes: selectors.notes.value,
    };
  }

  function createSubline(label, value) {
    const span = document.createElement('span');
    span.className = 'cell-subline';
    span.textContent = `${label}: ${value || '—'}`;
    return span;
  }

  function createIconButton(action, label, icon, danger = false) {
    const button = document.createElement('button');
    button.className = `action-mini${danger ? ' action-mini--danger' : ''}`;
    button.type = 'button';
    button.dataset.action = action;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.innerHTML = icon;
    return button;
  }

  function createSelectionCheckbox(entry, isSelected) {
    const label = document.createElement('label');
    label.className = 'row-check';
    label.title = `${entry.bookTitle || 'Eintrag'} markieren`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.action = 'select-entry';
    checkbox.checked = Boolean(isSelected);
    checkbox.setAttribute('aria-label', `${entry.bookTitle || 'Eintrag'} markieren`);

    const box = document.createElement('span');
    box.className = 'row-check__box';
    box.setAttribute('aria-hidden', 'true');

    label.append(checkbox, box);
    return label;
  }

  function renderEntries(entries, selectedIds = new Set()) {
    selectors.tbody.replaceChildren();
    selectors.emptyState.hidden = entries.length > 0;
    selectors.tbody.hidden = entries.length === 0;

    const fragment = document.createDocumentFragment();

    for (const entry of entries) {
      const tr = document.createElement('tr');
      tr.dataset.entryId = entry.id;
      if (selectedIds.has(entry.id)) tr.classList.add('is-selected');

      const selectionCell = document.createElement('td');
      selectionCell.className = 'select-cell';
      selectionCell.appendChild(createSelectionCheckbox(entry, selectedIds.has(entry.id)));

      const personCell = document.createElement('td');
      personCell.className = 'person-cell';
      const personName = document.createElement('strong');
      personName.textContent = `${entry.firstName} ${entry.lastName}`.trim() || '—';
      personCell.append(personName, createSubline('Pseudonym', entry.pseudonym), createSubline('Konto', entry.accountData));

      const titleCell = document.createElement('td');
      titleCell.className = 'title-cell';
      const title = document.createElement('strong');
      title.textContent = entry.bookTitle || 'Ohne Titel';
      const notes = document.createElement('span');
      notes.className = 'cell-subline';
      notes.textContent = entry.notes || 'Keine Notiz';
      titleCell.append(title, notes);

      const statusCell = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `badge ${badgeClass(entry.status)}`;
      badge.textContent = entry.status;
      const dateLine = document.createElement('span');
      dateLine.className = 'cell-subline';
      dateLine.textContent = `${statusDateLabel(entry.status)}: ${formatDate(entry.statusDate)}`;
      const editorialLine = document.createElement('span');
      editorialLine.className = 'cell-subline';
      editorialLine.textContent = `Im Lektorat: ${entry.inEditorial}`;
      statusCell.append(badge, dateLine, editorialLine);

      const contactCell = document.createElement('td');
      contactCell.appendChild(createSubline('Telefon', entry.phone));

      const actionsCell = document.createElement('td');
      actionsCell.className = 'actions-cell';
      actionsCell.append(
        createIconButton('edit', 'Eintrag bearbeiten', icons.edit),
        createIconButton('delete', 'Eintrag löschen', icons.delete, true)
      );

      tr.append(selectionCell, personCell, titleCell, statusCell, contactCell, actionsCell);
      fragment.appendChild(tr);
    }

    selectors.tbody.appendChild(fragment);
  }

  function updateStats(entries) {
    selectors.totalCount.textContent = entries.length;
    selectors.publishedCount.textContent = entries.filter((entry) => entry.status === 'Veröffentlicht').length;
    selectors.editorialCount.textContent = entries.filter((entry) => entry.inEditorial === 'Ja' || entry.status === 'Im Lektorat').length;
  }

  function showToast(title, message = '', type = 'info') {
    while (selectors.toastStack.children.length >= APP_CONFIG.maxToastCount) {
      selectors.toastStack.firstElementChild?.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    const strong = document.createElement('strong');
    strong.textContent = title;
    toast.appendChild(strong);
    if (message) {
      const span = document.createElement('span');
      span.textContent = message;
      toast.appendChild(span);
    }
    selectors.toastStack.appendChild(toast);

    const timeoutId = window.setTimeout(() => {
      toast.classList.add('is-leaving');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
      window.setTimeout(() => toast.remove(), 500);
    }, 3600);
    toast.addEventListener('click', () => {
      window.clearTimeout(timeoutId);
      toast.remove();
    }, { once: true });
  }

  function appendPreviewItems(previewItems = []) {
    selectors.confirmPreview.replaceChildren();
    if (!previewItems.length) {
      selectors.confirmPreview.hidden = true;
      return;
    }

    const fragment = document.createDocumentFragment();
    previewItems.forEach((item, index) => {
      const block = document.createElement('div');
      block.className = item.kind === 'more' ? 'confirm-preview__more' : 'confirm-preview__item';
      const title = document.createElement(item.kind === 'more' ? 'span' : 'strong');
      title.textContent = item.title || '';
      block.appendChild(title);
      if (item.subtitle) {
        const subtitle = document.createElement('span');
        subtitle.textContent = item.subtitle;
        block.appendChild(subtitle);
      }
      fragment.appendChild(block);
      if (index < previewItems.length - 1 && item.kind !== 'more') {
        const divider = document.createElement('hr');
        fragment.appendChild(divider);
      }
    });

    selectors.confirmPreview.hidden = false;
    selectors.confirmPreview.appendChild(fragment);
  }

  function readConfirmationPrefs() {
    try {
      const raw = localStorage.getItem(APP_CONFIG.confirmationStorageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      console.warn('UwU Books: Nachfragen konnten nicht gelesen werden.', error);
      return {};
    }
  }

  function writeConfirmationPrefs(prefs) {
    try {
      localStorage.setItem(APP_CONFIG.confirmationStorageKey, JSON.stringify(prefs || {}));
      return true;
    } catch (error) {
      console.warn('UwU Books: Nachfragen konnten nicht gespeichert werden.', error);
      return false;
    }
  }

  function shouldSkipConfirmation(skipKey) {
    if (!skipKey) return false;
    return readConfirmationPrefs()[skipKey] === true;
  }

  function rememberSkippedConfirmation(skipKey) {
    if (!skipKey) return false;
    const prefs = readConfirmationPrefs();
    prefs[skipKey] = true;
    const saved = writeConfirmationPrefs(prefs);
    updateConfirmationResetVisibility();
    return saved;
  }

  function resetSkippedConfirmations() {
    const saved = writeConfirmationPrefs({});
    updateConfirmationResetVisibility();
    return saved;
  }

  function hasSkippedConfirmations() {
    return Object.values(readConfirmationPrefs()).some(Boolean);
  }

  function updateConfirmationResetVisibility() {
    selectors.restoreConfirmBtn.hidden = !hasSkippedConfirmations();
  }

  function confirmDialog({ title, message, confirmText = 'Bestätigen', previewItems = [], skipKey = '' }) {
    if (shouldSkipConfirmation(skipKey)) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      let settled = false;
      let finished = false;
      let fallbackTimer = 0;

      selectors.confirmTitle.textContent = title;
      selectors.confirmMessage.textContent = message;
      selectors.confirmOkBtn.textContent = confirmText;
      selectors.confirmSkipCheckbox.checked = false;
      selectors.confirmSkipWrap.hidden = !skipKey;
      appendPreviewItems(previewItems);

      const cleanup = () => {
        window.clearTimeout(fallbackTimer);
        selectors.modalBackdrop.hidden = true;
        selectors.modalBackdrop.classList.remove('is-closing');
        selectors.confirmOkBtn.removeEventListener('click', onOk);
        selectors.confirmCancelBtn.removeEventListener('click', onCancel);
        selectors.modalBackdrop.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onKey);
        selectors.confirmPreview.replaceChildren();
        selectors.confirmSkipCheckbox.checked = false;
      };

      const close = (answer) => {
        if (settled) return;
        settled = true;
        if (answer && selectors.confirmSkipCheckbox.checked) {
          rememberSkippedConfirmation(skipKey);
        }
        selectors.modalBackdrop.classList.add('is-closing');
        const finish = () => {
          if (finished) return;
          finished = true;
          cleanup();
          resolve(answer);
        };
        selectors.modalBackdrop.addEventListener('animationend', finish, { once: true });
        fallbackTimer = window.setTimeout(finish, 320);
      };

      const onOk = () => close(true);
      const onCancel = () => close(false);
      const onBackdrop = (event) => {
        if (event.target === selectors.modalBackdrop) close(false);
      };
      const onKey = (event) => {
        if (event.key === 'Escape') close(false);
      };

      selectors.confirmOkBtn.addEventListener('click', onOk);
      selectors.confirmCancelBtn.addEventListener('click', onCancel);
      selectors.modalBackdrop.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onKey);
      selectors.modalBackdrop.hidden = false;
      selectors.confirmCancelBtn.focus({ preventScroll: true });
    });
  }

  function setSubmitLocked(isLocked) {
    selectors.saveBtn.disabled = Boolean(isLocked);
    selectors.resetFormBtn.disabled = Boolean(isLocked);
  }

  assertSelectors();

  UwUBooks.ui = Object.freeze({
    selectors,
    readForm,
    resetForm,
    fillForm,
    renderEntries,
    updateStats,
    setEditorialToggle,
    setSubmitLocked,
    statusDateLabel,
    showToast,
    confirmDialog,
    resetSkippedConfirmations,
    updateConfirmationResetVisibility,
    escapeHtml,
  });
})(window, document);

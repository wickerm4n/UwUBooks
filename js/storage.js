(function (window) {
  'use strict';

  const UwUBooks = window.UwUBooks = window.UwUBooks || {};
  const APP_CONFIG = UwUBooks.APP_CONFIG;
  const STATUS_SET = new Set(APP_CONFIG.statuses);
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function isPlainObject(value) {
    if (!value || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function stripControls(value) {
    return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  }

  function limitText(value, key) {
    const max = APP_CONFIG.fieldLimits[key] || 120;
    return stripControls(value).normalize('NFC').trim().slice(0, max);
  }

  function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function isValidIsoDate(value) {
    if (!DATE_RE.test(String(value || ''))) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function normalizeDate(value, fallback = todayIsoDate()) {
    const normalized = limitText(value, 'statusDate');
    return isValidIsoDate(normalized) ? normalized : fallback;
  }

  function normalizeDateTime(value) {
    const text = limitText(value, 'createdAt');
    if (!text) return new Date().toISOString();
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  function normalizeStatus(value) {
    const status = limitText(value, 'status');
    return STATUS_SET.has(status) ? status : 'Abgegeben';
  }

  function normalizeEditorial(value, status) {
    if (value === true || value === 'Ja' || status === 'Im Lektorat') return 'Ja';
    return 'Nein';
  }

  function normalizePhone(value) {
    return limitText(value, 'phone').replace(/[^0-9+\-()\s]/g, '').replace(/\s{2,}/g, ' ');
  }

  function createEntryId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      return `uwu-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
    }
    return `uwu-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeEntry(input, options = {}) {
    if (!isPlainObject(input)) {
      throw new Error('Ein Eintrag in der Sicherung ist unvollständig.');
    }

    const now = new Date().toISOString();
    const rawStatus = limitText(input.status, 'status');
    if (options.strict && !STATUS_SET.has(rawStatus)) {
      throw new Error('Ein Eintrag nutzt einen Status, den UwU Books nicht kennt.');
    }
    const rawStatusDate = limitText(input.statusDate, 'statusDate');
    if (options.strict && !isValidIsoDate(rawStatusDate)) {
      throw new Error('Ein Eintrag enthält ein Datum, das UwU Books nicht lesen kann.');
    }
    const status = normalizeStatus(rawStatus);
    const entry = Object.freeze({
      id: limitText(input.id, 'id') || createEntryId(),
      firstName: limitText(input.firstName, 'firstName'),
      lastName: limitText(input.lastName, 'lastName'),
      phone: normalizePhone(input.phone),
      accountData: limitText(input.accountData, 'accountData'),
      bookTitle: limitText(input.bookTitle, 'bookTitle'),
      status,
      statusDate: options.strict ? rawStatusDate : normalizeDate(input.statusDate),
      inEditorial: normalizeEditorial(input.inEditorial, status),
      pseudonym: limitText(input.pseudonym, 'pseudonym'),
      notes: limitText(input.notes, 'notes'),
      createdAt: normalizeDateTime(input.createdAt || now),
      updatedAt: normalizeDateTime(input.updatedAt || now),
    });

    if (options.requireRequiredFields !== false) {
      const missing = [];
      if (!entry.firstName) missing.push('Vorname');
      if (!entry.lastName) missing.push('Nachname');
      if (!entry.bookTitle) missing.push('Buchtitel');
      if (!entry.statusDate) missing.push('Datum');
      if (missing.length) {
        throw new Error(`Bitte ergänze noch: ${missing.join(', ')}`);
      }
    }

    return entry;
  }

  function entrySignature(entry) {
    return [
      entry.firstName,
      entry.lastName,
      entry.bookTitle,
      entry.statusDate,
      entry.pseudonym,
    ].map((part) => String(part || '').trim().toLowerCase()).join('|');
  }

  function getImportArray(data) {
    if (Array.isArray(data)) return data;
    if (isPlainObject(data) && Array.isArray(data.entries)) return data.entries;
    throw new Error('Diese Datei passt nicht zu UwU Books. Bitte wähle eine Sicherung, die über diese Seite erstellt wurde.');
  }

  function validateAndNormalizeEntries(data, options = {}) {
    const rawEntries = getImportArray(data);
    const maxEntries = APP_CONFIG.maxEntries;
    if (rawEntries.length > maxEntries) {
      throw new Error(`Diese Sicherung enthält ${rawEntries.length} Einträge. Möglich sind höchstens ${maxEntries} Einträge.`);
    }

    const normalized = [];
    const errors = [];
    const duplicateSignatures = new Set(options.knownSignatures || []);
    const knownIds = new Set(options.knownIds || []);
    let skippedDuplicates = 0;

    rawEntries.forEach((item, index) => {
      try {
        let entry = normalizeEntry(item, {
          requireRequiredFields: options.requireRequiredFields !== false,
          strict: Boolean(options.strict),
        });
        if (knownIds.has(entry.id)) {
          entry = Object.freeze({ ...entry, id: createEntryId() });
        }
        knownIds.add(entry.id);
        const signature = entrySignature(entry);
        if (options.dedupe && duplicateSignatures.has(signature)) {
          skippedDuplicates += 1;
          return;
        }
        duplicateSignatures.add(signature);
        normalized.push(entry);
      } catch (error) {
        errors.push(`Eintrag ${index + 1}: ${error.message}`);
      }
    });

    if (errors.length && !normalized.length) {
      throw new Error('Aus dieser Sicherung konnten keine passenden Einträge übernommen werden. Bitte prüfe, ob es die richtige UwU-Books-Sicherung ist.');
    }

    return Object.freeze({
      entries: normalized,
      errors,
      skippedInvalid: errors.length,
      skippedDuplicates,
    });
  }

  function loadEntries() {
    const keys = [APP_CONFIG.storageKey, ...(APP_CONFIG.legacyStorageKeys || [])];
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const result = validateAndNormalizeEntries(parsed, {
          requireRequiredFields: false,
          dedupe: true,
        });
        if (key !== APP_CONFIG.storageKey) {
          saveEntries(result.entries);
        }
        return result.entries;
      } catch (error) {
        console.warn(`UwU Books: gespeicherte Browser-Daten konnten nicht gelesen werden.`, error);
      }
    }
    return [];
  }

  function saveEntries(entries) {
    try {
      const normalized = validateAndNormalizeEntries(entries, {
        requireRequiredFields: false,
        dedupe: true,
      }).entries;
      localStorage.setItem(APP_CONFIG.storageKey, JSON.stringify(normalized));
      return true;
    } catch (error) {
      console.error('UwU Books: Speichern im Browser war nicht möglich.', error);
      return false;
    }
  }

  function downloadTextFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
    const safeName = String(filename || APP_CONFIG.exportFileBase).replace(/[^a-z0-9._-]/gi, '_').slice(0, 120);
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function neutralizeCsvFormula(value) {
    const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
    return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  }

  function toCsv(entries) {
    const header = [
      'Vorname', 'Nachname', 'Telefonnummer', 'Kontodaten', 'Buchtitel',
      'Status', 'Statusdatum', 'Im Lektorat', 'Pseudonym', 'Notizen', 'Erstellt am', 'Geändert am'
    ];

    const escape = (value) => {
      const normalized = neutralizeCsvFormula(value);
      return `"${normalized.replaceAll('"', '""')}"`;
    };

    const rows = entries.map((entry) => [
      entry.firstName,
      entry.lastName,
      entry.phone,
      entry.accountData,
      entry.bookTitle,
      entry.status,
      entry.statusDate,
      entry.inEditorial,
      entry.pseudonym,
      entry.notes,
      entry.createdAt,
      entry.updatedAt,
    ].map(escape).join(';'));

    return `${header.map(escape).join(';')}\n${rows.join('\n')}`;
  }

  function parseJsonImport(text) {
    const raw = String(text || '').replace(/^\uFEFF/, '');
    if (!raw.trim()) {
      throw new Error('Die ausgewählte Sicherung ist leer.');
    }
    const firstChar = raw.trimStart()[0];
    if (firstChar !== '[' && firstChar !== '{') {
      throw new Error('Diese Datei sieht nicht wie eine UwU-Books-Sicherung aus. Bitte wähle eine Sicherung aus UwU Books.');
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error('Die Sicherung konnte nicht gelesen werden. Bitte speichere sie erneut oder wähle eine andere UwU-Books-Sicherung.');
    }
  }

  UwUBooks.storage = Object.freeze({
    loadEntries,
    saveEntries,
    createEntryId,
    downloadTextFile,
    toCsv,
    normalizeEntry,
    entrySignature,
    validateAndNormalizeEntries,
    parseJsonImport,
  });
})(window);

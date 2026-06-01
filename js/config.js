(function (window) {
  'use strict';

  window.UwUBooks = window.UwUBooks || {};
  window.UwUBooks.APP_CONFIG = Object.freeze({
    appName: 'UwU Books',
    appVersion: '2026.06.01.1',
    storageKey: 'uwu-books.entries.v3',
    confirmationStorageKey: 'uwu-books.confirmations.v1',
    updateVersionUrl: 'version.json',
    updateCheckIntervalMs: 5 * 60 * 1000,
    updateInitialDelayMs: 20 * 1000,
    updateReloadSessionKey: 'uwu-books.update-reloaded.v1',
    legacyStorageKeys: Object.freeze(['uwu-books.entries.v2', 'uwu-books.entries.v1']),
    exportFileBase: 'uwu-books',
    dateLocale: 'de-DE',
    workStatuses: Object.freeze(['Offen', 'In Bearbeitung', 'Abgeschlossen']),
    legacyStatuses: Object.freeze(['Abgegeben', 'Veröffentlicht', 'Im Lektorat']),
    maxEntries: 1000,
    maxImportBytes: 2 * 1024 * 1024,
    maxToastCount: 5,
    fieldLimits: Object.freeze({
      id: 120,
      firstName: 60,
      lastName: 60,
      phone: 24,
      accountData: 120,
      bookTitle: 140,
      submittedDate: 10,
      publishedDate: 10,
      inEditorial: 4,
      takenBy: 80,
      workStatus: 40,
      pseudonym: 80,
      notes: 500,
      status: 40,
      statusDate: 10,
      createdAt: 40,
      updatedAt: 40,
    }),
  });
})(window);

(function (window) {
  'use strict';

  window.UwUBooks = window.UwUBooks || {};
  window.UwUBooks.APP_CONFIG = Object.freeze({
    appName: 'UwU Books',
    storageKey: 'uwu-books.entries.v2',
    confirmationStorageKey: 'uwu-books.confirmations.v1',
    legacyStorageKeys: Object.freeze(['uwu-books.entries.v1']),
    exportFileBase: 'uwu-books',
    dateLocale: 'de-DE',
    statuses: Object.freeze(['Abgegeben', 'Veröffentlicht', 'Im Lektorat']),
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
      status: 40,
      statusDate: 10,
      inEditorial: 4,
      pseudonym: 80,
      notes: 500,
      createdAt: 40,
      updatedAt: 40,
    }),
  });
})(window);

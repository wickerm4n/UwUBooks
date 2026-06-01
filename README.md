# UwU Books

Verwaltungsseite für UwU Books in GTA V.

## Dateien

```text
index.html
css/styles.css
js/config.js
js/storage.js
js/ui.js
js/app.js
assets/uwu-books-icon.svg
manifest.webmanifest
.nojekyll
```

## Nutzung

Einträge werden im Browser gespeichert. Die Daten liegen dadurch lokal auf dem jeweiligen Gerät und im jeweiligen Browserprofil. Für gemeinsame Nutzung durch mehrere Personen wird später eine Datenbank-Anbindung benötigt, zum Beispiel Firebase.

Über die Sicherungsfunktionen können Daten als JSON-Datei gespeichert und wieder eingespielt werden. Zusätzlich kann die Liste als CSV-Datei exportiert werden.

## Felder

- Vorname
- Nachname
- Telefonnummer
- Kontodaten
- Buchtitel
- Abgegeben am
- Veröffentlicht am
- Im Lektorat
- Übernommen von
- Bearbeitungsstatus
- Pseudonym
- Anmerkungen

## Hinweise

Die Seite verwendet keine externen Bibliotheken und lädt keine externen Skripte. Alle benötigten Dateien liegen im Projektordner.

Die `index.html` kann auch direkt lokal geöffnet werden. Für die Veröffentlichung sollte trotzdem GitHub Pages oder ein lokaler Webserver verwendet werden, damit das Verhalten dem späteren Betrieb entspricht.


## Aktualisierung auf GitHub Pages

Die Seite prüft im Hintergrund die Datei `version.json`. Wenn dort eine neue Version steht, lädt sich die geöffnete Seite einmal automatisch neu. Danach erscheint oben rechts ein kurzer Hinweis.

Bei Änderungen am Projekt sollte die Versionsnummer in folgenden Stellen angepasst werden:

- `version.json`
- `js/config.js`
- die `?v=`-Angaben in `index.html`

So werden neue Dateien auf GitHub Pages zuverlässiger geladen und alte Browser-Zwischenspeicher eher umgangen.

Aktuelle Version: `2026.06.01.1`


## Geteilte Listen mit Firebase

Die Seite kann geteilte Listen über Firebase Realtime Database speichern. Dafür wird kein Firebase-SDK geladen, sondern die Realtime-Database-REST-Schnittstelle genutzt.

### Einrichtung

1. In Firebase ein Projekt erstellen.
2. Unter **Build** die **Realtime Database** erstellen.
3. Die Datenbank-URL kopieren. Sie sieht ungefähr so aus:

```text
https://projektname-default-rtdb.europe-west1.firebasedatabase.app
```

4. In `js/config.js` Firebase aktivieren und die URL eintragen:

```js
firebase: Object.freeze({
  enabled: true,
  databaseUrl: 'https://projektname-default-rtdb.europe-west1.firebasedatabase.app',
  sharePath: 'uwuBooksShares',
  syncIntervalMs: 5000,
  pushDebounceMs: 900,
}),
```

5. In Firebase bei den Realtime-Database-Regeln die Regeln aus `database.rules.example.json` übernehmen.
6. Dateien auf GitHub Pages hochladen.

### Nutzung

Über den Share-Button im Header kann eine geteilte Liste erstellt werden. Danach gibt es zwei Links:

- Bearbeitungslink: Personen mit diesem Link können die Liste bearbeiten.
- Ansichtslink: Personen mit diesem Link können die Liste nur ansehen.

Die Seite gleicht Änderungen automatisch ab. Bei mehreren Personen gilt: Die zuletzt gespeicherte Änderung gewinnt.

### Hinweis

Die Beispiel-Regeln sind bewusst einfach gehalten und für eine kleine RP-Verwaltung gedacht. Wer echte personenbezogene Daten speichern möchte, sollte Firebase Authentication und strengere Regeln verwenden.

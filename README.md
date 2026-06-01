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

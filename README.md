# UwU Books

Verwaltungsseite für UwU Books im GTA RP.

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

Über die Sicherungsfunktionen können Daten als JSON-Datei gespeichert und später wieder eingespielt werden. Zusätzlich kann die Liste als CSV-Datei gespeichert werden.

## Felder

- Vorname
- Nachname
- Telefonnummer
- Kontodaten
- Buchtitel
- Status
- Statusdatum
- Im Lektorat
- Pseudonym
- Notizen

## Hinweise

Die Seite verwendet keine externen Bibliotheken und lädt keine externen Skripte. Alle benötigten Dateien liegen im Projektordner.

Die `index.html` kann auch direkt lokal geöffnet werden. Für die Veröffentlichung sollte trotzdem GitHub Pages oder ein lokaler Webserver verwendet werden, damit das Verhalten dem späteren Betrieb entspricht.

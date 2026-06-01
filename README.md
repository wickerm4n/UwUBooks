# UwU Books

Verwaltungsseite für UwU Books in GTA V.

## Nutzung

UwU Books dient zur Verwaltung von Bücherei-Einträgen. Einträge können angelegt, bearbeitet, gesucht, gefiltert, gelöscht und als Datei gespeichert werden.

Die Liste wird lokal im Browser gespeichert. Dadurch bleiben Einträge auf dem jeweiligen Gerät und im jeweiligen Browserprofil erhalten.

Über geteilte Listen können Einträge mit anderen Personen geteilt werden. Dafür nutzt UwU Books Firebase, damit mehrere Personen dieselbe Liste öffnen und Änderungen synchronisiert werden können.

## Geteilte Listen

Über den Share-Button kann eine geteilte Liste erstellt werden. Danach stehen zwei Links zur Verfügung:

- Bearbeitungslink: Personen mit diesem Link können die Liste bearbeiten.
- Ansichtslink: Personen mit diesem Link können die Liste nur ansehen.

Änderungen an geteilten Listen werden automatisch abgeglichen.

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

## Sicherungen

Einträge können als JSON-Sicherung gespeichert und später wieder eingespielt werden. Zusätzlich kann die Liste als CSV-Datei gespeichert werden.

## Hinweise

Die Seite verwendet keine externen Bibliotheken. Alle benötigten Dateien liegen im Projektordner.

Für die Veröffentlichung ist GitHub Pages vorgesehen.
## Datenschutz und Sicherheit

UwU Books verarbeitet Kontakt- und Kontodaten. Speichere deshalb nur Daten, die fuer den RP-Ablauf wirklich gebraucht werden.

- Lokale Listen liegen im Browser-Speicher des jeweiligen Geraets.
- Geteilte Listen werden in Firebase gespeichert und sind ueber den jeweiligen Link abrufbar.
- JSON- und CSV-Exporte enthalten die sichtbaren Eintragsdaten im Klartext.
- Ansichtslinks erlauben Lesen; Bearbeitungslinks sind Berechtigungen zum Bearbeiten und sollten nur an vertrauenswuerdige Personen gehen.
- Der Bearbeitungsschluessel wird im Link-Fragment (`#key=...`) transportiert und nach dem Oeffnen in der aktuellen Browser-Sitzung gemerkt. Dadurch wird er nicht an den Webserver uebertragen.
- Wenn ein Bearbeitungslink weitergegeben wurde, sollte die geteilte Liste neu erstellt und der alte Link nicht weiter genutzt werden.

Fuer echten Schreibschutz muessen Firebase-Regeln, Firebase Auth oder eine Backend-/Cloud-Function-Schicht Schreibzugriffe serverseitig pruefen. Reine UI-Sperren im Browser reichen dafuer nicht aus.

Fuer produktives Hosting sollten zusaetzlich HTTP-Sicherheitsheader gesetzt werden, besonders `Content-Security-Policy`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` oder ein wirksames `frame-ancestors 'none'` als Header, sowie eine restriktive `Permissions-Policy`. GitHub Pages unterstuetzt eigene Header nur eingeschraenkt; bei Cloudflare Pages, Netlify oder einem eigenen Webserver laesst sich das sauber konfigurieren.

Weitere Details zum Firebase-Schreibschutz stehen in FIREBASE_SECURITY.md.

# Firebase-Sicherheit für UwU Books

Diese Datei ist für Admins gedacht, die UwU Books mit Firebase betreiben oder die Firebase-Regeln anpassen möchten.

Kurz gesagt: Die Webseite kann zwischen **Ansicht** und **Bearbeitung** unterscheiden. Firebase muss aber zusätzlich entscheiden, wer wirklich in die Datenbank schreiben darf.

## Was macht die Webseite?

UwU Books erstellt beim Teilen zwei Links:

- **Ansichtslink:** Öffnet die Liste nur zum Anschauen.
- **Bearbeitungslink:** Öffnet die Liste mit Bearbeitungsrechten.

Im Browser werden die Bearbeitungsbuttons ausgegraut, wenn jemand nur den Ansichtslink nutzt. Für normale Nutzerinnen und Nutzer funktioniert das genau so, wie es gedacht ist.

## Wo liegt die Grenze?

Die Webseite läuft komplett im Browser. Alles, was im Browser passiert, kann eine technisch erfahrene Person grundsätzlich untersuchen oder umgehen.

Deshalb ist wichtig:

- Die Webseite kann Buttons ausblenden.
- Die Webseite kann prüfen, ob der Bearbeitungslink passt.
- Aber Firebase entscheidet am Ende, ob ein Schreibzugriff wirklich erlaubt ist.

Wenn die Firebase-Regeln Schreiben für alle erlauben, kann jemand mit dem Link theoretisch direkt an Firebase schreiben, auch ohne die Buttons der Webseite zu benutzen.

## Die einfachen Firebase-Regeln

Diese Regeln funktionieren grundsätzlich mit UwU Books:

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "uwuBooksShares": {
      "$shareId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

Damit gilt:

- Die Datenbank ist nicht komplett öffentlich.
- Geteilte Listen sind über ihren geheimen Sharelink lesbar.
- Geteilte Listen können über ihren Firebase-Pfad beschrieben werden.
- Die Webseite selbst unterscheidet trotzdem zwischen Ansichtslink und Bearbeitungslink.

Für eine kleine, vertraute RP-Community kann das ausreichend sein, solange die Links nicht öffentlich gepostet werden und keine sehr sensiblen Daten eingetragen werden.

Es ist aber kein echter technischer Schreibschutz gegen Personen, die bewusst versuchen, die Webseite zu umgehen.

## Was wurde im Code bereits verbessert?

Der aktuelle Code reduziert einige Risiken:

- Der Bearbeitungsschlüssel steht bei neuen Links im `#key=...`-Teil der URL.
- Dieser Teil wird nicht an den Webserver gesendet.
- Der Schlüssel wird nach dem Öffnen aus der sichtbaren URL entfernt.
- Share-IDs und Bearbeitungsschlüssel werden auf ein festes Format geprüft.
- Beim Speichern wird geprüft, ob die Liste zwischenzeitlich von jemand anderem geändert wurde.
- Geteilte Listen überschreiben nicht mehr automatisch die lokale Browserliste.

Das macht die Nutzung sauberer und sicherer, ersetzt aber keine echten Firebase-Schreibregeln.

## Was bedeutet das praktisch?

Wenn ihr UwU Books einfach für eine vertraute RP-Gruppe nutzen möchtet:

- Bearbeitungslinks nur an vertrauenswürdige Personen geben.
- Ansichtslinks nicht öffentlich posten.
- Keine unnötig privaten Daten eintragen.
- Bei einem versehentlich geteilten Bearbeitungslink eine neue geteilte Liste erstellen.

Wenn ihr echten Schutz gegen unerlaubtes Bearbeiten wollt, braucht es eine stärkere Lösung.

## Stärkere Möglichkeiten

### 1. Firebase Anonymous Auth

Firebase kann anonyme Nutzerkonten erstellen. Dann bekommt jede Person eine eigene Firebase-ID.

Das alleine reicht aber noch nicht. Die Regeln müssten zusätzlich prüfen, welche Firebase-ID eine Liste bearbeiten darf.

Das wäre ein sinnvoller nächster Schritt, braucht aber Code- und Datenstruktur-Anpassungen.

### 2. Cloud Function oder kleines Backend

Eine Cloud Function kann den Bearbeitungsschlüssel prüfen und nur dann Änderungen speichern.

Das ist technisch sauberer, weil die Prüfung nicht nur im Browser passiert.

### 3. Verschlüsselung

Die Liste könnte im Browser verschlüsselt werden, sodass Firebase nur verschlüsselte Daten sieht.

Das schützt die Inhalte besser, macht Teilen und Wiederherstellen aber komplizierter.

## Bestehende Sharelinks

Mit den aktuellen Regeln und dem aktuellen Code bleiben bestehende Sharelinks gültig.

Alte Bearbeitungslinks mit `?key=...` funktionieren weiterhin. Der Code liest den Schlüssel aus, merkt ihn sich für die aktuelle Browser-Sitzung und entfernt ihn danach aus der sichtbaren URL.

Neue Bearbeitungslinks nutzen `#key=...`.

Wenn die Firebase-Regeln später deutlich strenger gemacht werden, müssten bestehende geteilte Listen eventuell einmal migriert oder neu erstellt werden.

## Empfehlung

Für die aktuelle RP-Nutzung:

- Die einfachen Regeln sind nutzbar, wenn die Links wirklich vertraulich bleiben.
- Der Bearbeitungslink sollte wie ein Passwort behandelt werden.
- Für echte Zugriffskontrolle sollte später Firebase Auth oder eine Cloud Function ergänzt werden.

Die wichtigste Faustregel: Die Webseite schützt vor versehentlichem Bearbeiten. Firebase-Regeln schützen vor absichtlichem Umgehen.

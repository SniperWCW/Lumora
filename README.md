# Lumora

Schnelles Home-Assistant-Dashboard als einzelne, abhängigkeitsfreie Karte (kein button-card, card-mod oder layout-card).

- Persönliche Begrüßung mit Avatar des angemeldeten Benutzers, Anwesenheit aller Personen, Wetter und Alarmstatus
- Energie-Karte (PV, Verbrauch, Netz, Batterie) auf der Startseite
- Spezialkarten für Thermostate (Slider für die Solltemperatur) und Staubsauger (Start, Pause, Station)
- Startseite mit gefilterten Meldungen: offene Türen und Fenster, Bewegung, Rauch, Wasser, Gas und Alarm
- Meldungen sind konfigurierbar (Kategorien an oder aus, einzelne Sensoren ausblenden), gespeichert pro HA-Benutzer
- "Aktiv jetzt" mit Lichtern, Medien und frei hinzufügbaren Karten, optional nur bei Aktivität
- Steckdosen-Karten: Ein/Aus, aktuelle Leistung in Watt und Tagesspitze mit Uhrzeit (Leistungssensor am selben Gerät wird automatisch zugeordnet)
- Räume je Etage und Area, Kameraübersicht; Temperatur und Luftfeuchte im Raumkopf automatisch aus der Area (abgeleitete Werte wie Taupunkt werden ignoriert), pro Raum wählbar unter Bearbeiten, Sensoren
- Tab "Mehr": Haushaltsgeräte (Waschmaschine, Trockner, Spülmaschine mit Programm, Fortschritt, Restzeit), Pakete, Energie, Zähler (Strom, Gas, Wasser, Ersparnis), 3D-Drucker, Pool, Wetter, Tankzeit, HA-Health, Pi-hole, Lage Deutschland. Karten ohne verfügbare Daten bleiben ausgeblendet
- Warn-Chips neben "x Lampen an" und in der Meldungszeile: DWD-Wetterwarnungen (automatisch erkannt), NINA-Warnungen, Eiswarnung, Fahrrad-Hinweis, Pollen (nur bei Belastung) und Fahrzeiten (Waze, Bahn); Details per Tipp. Ein- und ausschaltbar unter Meldungen
- Lüftungszeile unter Temperatur und Luftfeuchte (Room Climate): Empfehlung, Dauer, erste Räume, nächstes Lüftungsfenster
- Room-Climate-Meldungen: Schimmelrisiko, Fenster schließen, Jetzt lüften, Rollladen, Heizung; Bewegung als Chip mit Raumnamen
- Chips frei wählbar: im Bearbeiten-Modus der Startseite Chips antippen
- Im Bearbeiten-Modus wird nichts neu gezeichnet, damit sich Elemente in Ruhe verschieben lassen
- Gemeinsames Layout für alle: als Administrator im Bearbeiten-Modus "Layout für alle speichern" (schreibt `layout:` in die Karte des Dashboards). Andere Benutzer sehen es und können es nicht ändern. Mit `shared: false` bleibt alles pro Benutzer
- Personen-Chips ausblendbar und verschiebbar
- Startseite zeigt laufende Geräte, Pakete in Zustellung und den Drucker während des Drucks automatisch
- Bearbeiten-Modus auf Start, Räumen und Kameras: ausblenden (Auge) und verschieben per Drag and Drop (gedrückt halten und ziehen) für Etagen, Räume, Kacheln, Kameras und angepinnte Karten; Räume von Meldungen ausnehmen

## Installation

### HACS (benutzerdefiniertes Repository, Typ Dashboard)

1. HACS, drei Punkte, Benutzerdefinierte Repositories, `https://github.com/SniperWCW/Lumora`, Typ **Dashboard**
2. Lumora herunterladen. HACS legt die Ressource `/hacsfiles/Lumora/lumora.js` an.

### Manuell

1. `lumora.js` nach `/config/www/lumora/` kopieren
2. Einstellungen, Dashboards, Ressourcen: `/local/lumora/lumora.js` als JavaScript-Modul hinzufügen

## Verwendung

Dashboard-Ansicht vom Typ `panel` mit folgender Karte:

```yaml
type: custom:lumora-card
# optional
theme: sand        # Standard; alternativ: forest
name: Anna         # optional, sonst Name aus der Person des Benutzers
energy:            # optional
  pv: sensor.pv_leistung
  consumption: sensor.hausverbrauch
  grid_in: sensor.netz_bezug
  grid_out: sensor.netz_einspeisung
  battery_in: sensor.batterie_laden
  battery_out: sensor.batterie_entladen
  soc: sensor.batterie_ladestand
  forecast: sensor.pv_prognose_heute
info:              # optional
  ice: sensor.eiswarnung
  bike: sensor.fahrrad_wetter
  pollen: sensor.pollen_risiko
  travel: [["Zur Arbeit", sensor.fahrzeit_arbeit]]
  trains: [["Bahnhof A → B", sensor.abfahrten_a_nach_b]]
color_from: "#f2eadb"
color_to: "#d6c5a8"
```

## Releases

Jeder Push auf `main`, der `lumora.js` oder `hacs.json` ändert, erzeugt automatisch Tag und Release (GitHub Actions).
Die Version ergibt sich aus den Commit-Nachrichten seit dem letzten Tag:

| Commit-Nachricht | Version |
| --- | --- |
| `BREAKING CHANGE` oder `feat!:` | Major |
| `feat: ...` | Minor |
| alles andere | Patch |

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
name: Steffen      # optional, sonst Name aus der Person des Benutzers
energy:            # optional, Standard sind die SOLARWATT-Flow-Sensoren
  pv: sensor.solarwatt_flow_pv_out
  consumption: sensor.solarwatt_flow_consumption_in
  grid_in: sensor.solarwatt_flow_grid_in
  grid_out: sensor.solarwatt_flow_grid_out
  battery_in: sensor.solarwatt_flow_battery_in
  battery_out: sensor.solarwatt_flow_battery_out
  soc: sensor.solarwatt_battery_soc
  forecast: sensor.solcast_pv_forecast_prognose_spitzenleistung_heute
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

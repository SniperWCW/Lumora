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
- Pool-Karte (Smart Pool Assistant + LayzSpa): Status, Badeampel, PoolLab-Abruf, Chlor-/pH-/CYA-Empfehlung mit Eintragen von Zugaben und Wasserwechsel, Berechnungsdetails, Wetter, Stabilität, Messwerte, LayzSpa (Pumpe, Heizung, Blubber, Zieltemperatur, Heizzeit-Prognose, Fehlercodes), Aktivitäten, Filterwartung, Abdeckung, Nutzung und Badeplan. Winterschlaf blendet sie aus. Ohne Integration bleibt die LayzSpa-Steuerung
- Tab "Mehr": Haushaltsgeräte (Waschmaschine, Trockner, Spülmaschine mit Programm, Fortschritt, Restzeit), Pakete, Energie, Zähler (Strom, Gas, Wasser, Ersparnis), 3D-Drucker, Pool, Wetter, Tankzeit, HA-Health, Pi-hole, Lage Deutschland. Karten ohne verfügbare Daten bleiben ausgeblendet
- Warn-Chips neben "x Lampen an" und in der Meldungszeile: DWD-Wetterwarnungen (automatisch erkannt), NINA-Warnungen, Eiswarnung, Fahrrad-Hinweis, Pollen (nur bei Belastung) und Fahrzeiten (Waze, Bahn); Details per Tipp. Ein- und ausschaltbar unter Meldungen
- Lüftungszeile unter Temperatur und Luftfeuchte (Room Climate): Empfehlung, Dauer, erste Räume, nächstes Lüftungsfenster
- Room-Climate-Meldungen: Schimmelrisiko, Fenster schließen, Jetzt lüften, Rollladen, Heizung; Bewegung als Chip mit Raumnamen
- Chips frei wählbar: im Bearbeiten-Modus der Startseite Chips antippen
- Automatische Erkennung von Sensoren (Energie, Zähler, Geräte, Pakete, Drucker, Pool, System, Warnungen, Fahrzeiten, Bahnverbindungen). Gefundenes ist vorausgefüllt, Fehlendes bleibt unsichtbar. Anpassen im Bearbeiten-Modus unter "Quellen" oder per YAML
- Kamera-Vorschau auf der Startseite: Kameras im Bearbeiten-Modus unter "Kameras" wählen; Bilder aktualisieren sich alle 10 Sekunden ohne Flackern. Angepinnte Kameras erscheinen ebenfalls als Vorschau
- Im Bearbeiten-Modus wird nichts neu gezeichnet, damit sich Elemente in Ruhe verschieben lassen
- Gemeinsames Layout für alle: als Administrator im Bearbeiten-Modus "Layout für alle speichern" (schreibt `layout:` in die Karte des Dashboards). Andere Benutzer sehen es und können es nicht ändern. Mit `shared: false` bleibt alles pro Benutzer
- Startseite zeigt laufende Geräte, Pakete in Zustellung und den Drucker während des Drucks automatisch
- Bearbeiten-Modus auf Start, Räumen und Kameras: ausblenden (Auge) und verschieben per Drag and Drop (gedrückt halten und ziehen) für Etagen, Räume, Kacheln, Kameras und angepinnte Karten; Räume von Meldungen ausnehmen
- Schnellaktionen: Szenen, Skripte, Tasten und "Alles Licht aus" als Chips mit einem Tipp (Bearbeiten, dann Aktion hinzufügen)
- Batterie-Karte (erscheint nur bei schwachen Batterien, Grenze einstellbar) und Karte "Geräte offline" (Geräte, deren Entitäten alle nicht erreichbar sind); einzelne Geräte lassen sich ausblenden
- Verläufe: Sparklines für Raumtemperatur im Raumkopf, Energie-Verlauf (PV und Verbrauch, 24 h) und eigene Karten mit frei wählbarem Zeitraum
- Eigene Karten: beliebige Entität als Wert, Verlauf oder Schalter (Karte hinzufügen, "Als eigene Karte"); Titel, Darstellung und Zeitraum über das Zahnrad
- Kartengröße: im Bearbeiten-Modus pro Karte klein, breit oder volle Breite (auch Kacheln in den Räumen); jede Karte lässt sich zwischen Zuhause und Mehr verschieben
- Freie Platzierung: im Bearbeiten-Modus am Ordner-Symbol einer Karte (Zuhause, Mehr oder ein beliebiger Raum wählen); in Räumen über "Karte" Karten in den Raum holen
- Gerätekarten: vordefinierte Karten pro Gerät (Karte hinzufügen, Gerätekarte), derzeit Staubsauger (Start/Pause, Station, Finden, Saugstufe, Fläche, Dauer, Filter und Bürsten, Fehler) und PV-Anlage (Leistung, Verlauf, Ertrag heute und gesamt, Strings, Prognose). Passende Entitäten werden automatisch gefunden, zuerst am selben Gerät, dann an gleichem Namensanfang. Jedes Feld lässt sich über das Zahnrad der Karte selbst wählen oder abschalten. Mehrere Karten desselben Typs sind möglich. Eigene Vorlagen: `window.LumoraDevices.register({ type, label, icon, main, fields, render })`
- Karten-Register: jede Karte ist ein Objekt (`id`, `label`, `icon`, `home`, `size`, `items`). Fehler in einer Karte legen nicht das Dashboard lahm. Erweiterbar per `window.LumoraCards.register({...})`

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
energy:            # optional, überschreibt die automatische Erkennung
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

## Pool-Karte

Alle Entitäten werden automatisch erkannt (Quellen, Gruppe Pool) und lassen sich unter "Quellen" oder per YAML überschreiben:

```yaml
type: custom:lumora-card
extras:
  pool_rec: sensor.pool_empfehlung
  pool_winter: input_boolean.pool_winterschlaf
  lz_conn: binary_sensor.layzspa_connection
  lz_ctl: climate.layzspa_temperature_control
pool:                      # optional
  weather_entity: weather.home
  heat_eta: { enabled: true, history_hours: 48, fallback_rate_c_per_hour: 3 }
```

Die Karte ist standardmäßig in voller Breite; bei klein oder breit zeigt sie nur Status, Badeampel und Messwerte.

## Releases

Jeder Push auf `main`, der `lumora.js` oder `hacs.json` ändert, erzeugt automatisch Tag und Release (GitHub Actions).
Die Version ergibt sich aus den Commit-Nachrichten seit dem letzten Tag:

| Commit-Nachricht | Version |
| --- | --- |
| `BREAKING CHANGE` oder `feat!:` | Major |
| `feat: ...` | Minor |
| alles andere | Patch |

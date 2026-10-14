# Collection52

Collection52 ist eine zugängliche, serverautoritative Echtzeit-Plattform für Kartenspiele. Version 1 enthält **Podkidnoy Durak** für zwei bis sechs Personen, wahlweise mit 36 oder 52 Karten. Es gibt keine Konten, Werbung oder Analyse-Tracker.

## Schnellstart

Voraussetzungen: Node.js 22+ und npm 10+.

```bash
npm install
npm run dev
```

Danach läuft die Oberfläche unter `http://localhost:5173`, der Server unter `http://localhost:3001`. Zwei getrennte Browserprofile oder private Fenster simulieren mehrere Spieler.

Qualitätsbefehle:

```bash
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## Architektur

- `packages/shared`: typisiertes Protokoll, Kartenmodell und deterministische Durak-Regel-Engine. Die Engine arbeitet ohne Netzwerk- oder UI-Abhängigkeiten und liefert unveränderliche Folgezustände.
- `apps/server`: Express/Socket.IO, flüchtige Lobbyverwaltung, Autorisierung, kryptografische Tokens/Zufallszahlen, Passwort-Hashing, Reconnect und Inaktivitätsbereinigung.
- `apps/client`: React/Vite, DE/EN-i18n, responsives Designsystem, Tastatur- und Screenreader-Bedienung sowie optionale Web-Speech-Ausgabe.

Der Server hält den vollständigen Zustand. Ein Client sendet nur Absichten mit der erwarteten Zustandsversion. Jeder Spieler erhält eine eigene Sicht, in der fremde Handkarten entfernt sind. Pro Spieler ist nur die zuletzt wiederhergestellte Socket-Verbindung aktionsberechtigt. In Version 1 liegt der Zustand im Prozessspeicher; ein Serverneustart beendet daher bestehende Lobbys. Für horizontale Skalierung müssen Lobbyzustand, Sperren und Socket.IO-Pub/Sub gemeinsam (zum Beispiel in Redis) abgelegt werden.

## Multiplayer-Protokoll und Sitzungen

Die wichtigsten Client-Ereignisse sind `lobby:create`, `lobby:join`, `lobby:resume`, `game:start`, `game:action`, `game:restart` und `lobby:close`. Serverantworten laufen über typisierte Acknowledgements; Zustände werden über `lobby:state`, Ereignisse über `game:event` verteilt. Spielaktionen enthalten `expectedVersion`, wodurch veraltete oder doppelte Eingaben abgewiesen werden.

Beim Erstellen/Beitreten erhält der Browser ein zufälliges, lobbygebundenes Sitzungstoken. Nur dessen SHA-256-Hash liegt im Serverzustand; das Token bleibt lokal im Browser und erscheint nie in Einladungslinks. Ein Reload oder Reconnect stellt damit Platz, eigene Hand und Rechte wieder her. Der Host wird nie übertragen. Heartbeats und automatische Reconnects verlängern die 30-Minuten-Frist nicht.

## Durak-Regeln

Implementiert ist klassisches Podkidnoy Durak nach den verbindlichen Produktregeln: initial genau eine Angriffskarte, deterministische Nachlegereihenfolge, maximal `min(6, anfängliche Hand des Verteidigers)` Angriffe, Verteidiger zieht zuletzt, Trumpfkarte zuletzt, korrektes Ausscheiden erst nach abgeschlossener Runde. Bei erfolgreicher Verteidigung greift der Verteidiger als Nächstes an; nach Aufnahme wird er übersprungen. Regionale Varianten, Weitergabe, Teams und Bots sind nicht enthalten. Referenz: [Pagat – Podkidnoy Durak](https://www.pagat.com/beating/podkidnoy_durak.html).

## Barrierefreiheit

Semantische Bereiche, sichtbarer Fokus, Skip-Link, native Buttons/Formulare, Live-Status, beschriftete Karten und eine explizite Auswahl von Angriffsziel und Verteidigungskarte machen alle Kernabläufe per Tastatur und Screenreader nutzbar. System/Hell/Dunkel, hoher Kontrast, größere Schrift/Karten und reduzierte Bewegung sind lokal gespeichert. Web Speech ist optional und getrennt von Screenreader-Meldungen.

Automatisiert geprüft werden WCAG-A/AA-Regeln mit axe sowie Desktop- und Mobilabläufe mit Playwright. Manuelle Prüfungen mit NVDA/Firefox, NVDA/Chrome und VoiceOver/Safari bleiben vor jedem öffentlichen Release erforderlich; automatisierte Prüfungen sind kein Konformitätsnachweis. Eine Prüfliste liegt in [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md).

## Datenschutz und Sicherheit

Verarbeitet werden Anzeigename, temporäre Lobby-/Spielzustände, Verbindungsstatus und lokal gespeicherte Präferenzen/Sitzungstoken. Lobbys werden nach 30 Minuten ohne relevante Interaktion samt Verlauf aus dem Speicher gelöscht. Passwörter werden mit scrypt und individuellem Salt gehasht. Es gibt keine dauerhafte Historie, Marketing-Cookies, Tracker oder Drittanbieter-Schriften. Diese technische Beschreibung ist keine Rechtsberatung oder Zusicherung rechtlicher Konformität.

Produktionswerte werden über `.env` gesetzt; siehe `.env.example`. Hinter einem Reverse Proxy müssen HTTPS/WSS, korrekte Origin-Werte und Weiterleitung von WebSocket-Upgrades konfiguriert sein.

## Docker

```bash
docker compose up --build
```

Die Anwendung ist dann auf Port 3001 verfügbar. Das Image läuft als unprivilegierter Benutzer, besitzt einen Healthcheck und reagiert auf SIGTERM mit einem Graceful Shutdown.

## Erweiterung

Ein neues Spiel erhält ein eigenes reines Regelmodul analog `durak.ts`: Konfiguration, Initialzustand, validierte Aktionen, Zustandsübergänge und spielerspezifische Sicht. Anschließend wird es in die serverseitige Spielauswahl aufgenommen; Lobby, Tokens und Reconnect bleiben unverändert. Neue Sprachen kommen als vollständige JSON-Ressource unter `apps/client/src/locales` hinzu. Kartendesigns dürfen ausschließlich `CardFace`/CSS ersetzen und müssen den zugänglichen Kartentext bewahren.

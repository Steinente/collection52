# Manuelle Accessibility-Prüfliste

Automatische axe-Prüfungen decken nur einen Teil der WCAG-Anforderungen ab. Vor einer Freigabe sind mindestens folgende Prüfungen zu dokumentieren:

- Nur Tastatur: Startseite, Erstellen, Beitreten, Kopieren/Teilen-Fallback, Start, Angriff, Zielauswahl, Verteidigung, Aufnahme, Passen, Ergebnis, Neustart und Schließen. Fokus muss sichtbar und logisch sein; kein Fokus darf gefangen werden.
- NVDA mit Firefox und Chrome: Überschriften-/Bereichsnavigation, Formularfehler, Statusansagen, Kartenposition/-zustand, Tischzuordnung, Disconnect/Reconnect und Dialoge.
- VoiceOver mit Safari (macOS und iOS): dieselben Kernabläufe sowie Rotor-Navigation und Touch-Erkundung.
- Zoom bei 200 % und 400 %, Reflow bei 320 CSS-Pixel, Quer-/Hochformat und große Systemschrift.
- Kontrast aller Themes und Zustände; Informationen dürfen nicht ausschließlich über Farbe vermittelt werden.
- `prefers-reduced-motion`, große Karten, hohe Kontraste sowie optionale Sprachausgabe einschließlich Aus/Ein, Warteschlange, Tempo, Lautstärke und Wiederholung.
- Prüfung, dass Screenreader-Live-Region und synthetische Sprachausgabe nicht gleichzeitig unkontrolliert überlagern. Für Screenreader-Nutzung sollte Web Speech deaktiviert bleiben.

Testergebnis, Browser/AT-Version, Datum und offene Abweichungen gehören in den Release-Nachweis.

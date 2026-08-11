# Roadmap

## v1.1 (nächstes kostenpflichtiges Feature-Set vorbereiten, Updates 1.x kostenlos)
- **ZUGFeRD-2.3-Export (Hybrid-PDF)**: CII-XML erzeugen + PDF/A-3-Einbettung
  (factur-x.xml, AFRelationship, XMP-Metadaten, eingebettete Fonts, sRGB-OutputIntent);
  Validierung mit veraPDF + Mustang-Projekt einplanen.
- **Lizenz-Automatisierung**: Cloudflare Worker für Lemon-Squeezy-Webhook → signiert
  Schlüssel automatisch (kein manueller Versand mehr).
- E-Mail-Vorlagen-Knopf („Rechnung versenden“ öffnet Mailto mit Standardtext).
- Datei-basierte Ablage via File System Access API (Backup-Risiko weiter senken).

## v1.2
- **XRechnung 4.0** (KoSIT-Ankündigung: Ende 2026, EN 16931-1:2026/ViDA):
  CustomizationID + Regeländerungen übernehmen; Übergangszeitraum beide Profile anbieten.
- Angebote & Auftragsbestätigungen (gleiche Engine, anderes Dokument).
- CSV-Export für Steuerberater (DATEV-freundlich).

## v2 (kostenpflichtiges Upgrade)
- Peppol-Versand über Access-Point-Partner (dann erstmals serverseitige Komponente).
- Team-Funktionen (gemeinsamer Stamm via Datei-Sync).
- E-Mail-Eingang: Postfach-Anbindung zum automatischen Prüfen eingehender Rechnungen.

## Bewusst verworfen
- Eigenes Cloud-Backend (zerstört den Datenschutz-USP und die Kostenstruktur).
- Elektronische Signaturen (für E-Rechnungen nicht erforderlich).
- DRM/Online-Aktivierungszwang (Zielgruppen-feindlich).

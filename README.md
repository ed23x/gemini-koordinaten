# Gemini Koordinaten-Visualisierung

Eine minimalistische Web-App zur Visualisierung von Punkten in einem Koordinatensystem mit Gemini API-Integration.

## Funktionen

- **API-Schlüssel-Verwaltung**: Sichere Speicherung des Gemini API-Schlüssels als lokales Cookie
- **Koordinatensystem**: Interaktive Darstellung von Punkten mit beschriftbaren Achsen
- **Datei-Upload**: Verarbeitung von Bildern und anderen Dateien mit dem Gemini-2.5-flash-preview-05-20 Modell
- **Achsenbeschriftung**: Anpassbare X- und Y-Achsenbeschreibungen für die KI-Interpretation
- **Linienoptionen**: Auswahl zwischen gerundeten und eckigen Linienverbindungen
- **Export-Funktionen**: Export des Koordinatensystems als Bild
- **JSON-Handling**: Export und Import der Punktdaten und Einstellungen als JSON-Datei
- **Interaktive Punkte**: Anzeige der genauen X- und Y-Werte beim Überfahren eines Punktes

## Technologien

- React mit TypeScript
- Vite als Build-Tool
- Tailwind CSS für das Styling
- shadcn/ui für UI-Komponenten
- Recharts für Diagramme

## Voraussetzungen

- Node.js (Version 18 oder höher)
- pnpm (empfohlen) oder npm
- Ein gültiger Gemini API-Schlüssel

## Installation

1. Klonen Sie das Repository oder entpacken Sie die ZIP-Datei:

```bash
git clone <repository-url>
# oder entpacken Sie die ZIP-Datei
```

2. Navigieren Sie in das Projektverzeichnis:

```bash
cd gemini-koordinaten-app
```

3. Installieren Sie die Abhängigkeiten:

```bash
pnpm install
# oder
npm install
```

## Entwicklung

Starten Sie den Entwicklungsserver:

```bash
pnpm run dev
# oder
npm run dev
```

Die Anwendung ist dann unter [http://localhost:5173](http://localhost:5173) verfügbar.

## Build

Erstellen Sie eine produktionsreife Version:

```bash
pnpm run build
# oder
npm run build
```

Die Build-Dateien werden im `dist`-Verzeichnis abgelegt.

## Deployment

### Lokales Testen des Builds

```bash
pnpm run preview
# oder
npm run preview
```

### Deployment auf Vercel

Dieses Projekt ist für das Deployment auf Vercel vorkonfiguriert. Sie können es direkt über die Vercel-Plattform deployen:

1. Importieren Sie das Projekt in Vercel
2. Vercel erkennt automatisch die Konfiguration und führt den Build-Prozess durch
3. Nach dem Deployment ist die App unter der von Vercel bereitgestellten URL verfügbar

Alternativ können Sie die Vercel CLI verwenden:

```bash
npm install -g vercel
vercel login
vercel
```

## Nutzung

1. Geben Sie Ihren Gemini API-Schlüssel ein und speichern Sie ihn
2. Definieren Sie die Bedeutung der X- und Y-Achse
3. Laden Sie eine Datei hoch oder importieren Sie vorhandene JSON-Daten
4. Wählen Sie den gewünschten Linienstil (gerundet oder eckig)
5. Exportieren Sie das Ergebnis als Bild oder JSON-Datei

## Hinweise

- Der API-Schlüssel wird ausschließlich lokal im Browser gespeichert und nicht an den Server übertragen
- Die Anwendung verwendet das Modell "gemini-2.5-flash-preview-05-20" für die Datenverarbeitung
- Für die volle Funktionalität ist eine aktive Internetverbindung erforderlich

## Lizenz

MIT

import { useState, useEffect, useRef } from "react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Sun, Moon } from "lucide-react";
import { Label } from "./components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Groq } from 'groq-sdk';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import { Download, Save, Eye, EyeOff } from "lucide-react";
import CoordinateSystem from "./components/CoordinateSystem";
import Loader from "./components/Loader";
import "./App.css";

interface Point {
  x: number;
  y: number;
}

function App() {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [xAxisLabel, setXAxisLabel] = useState<string>("pH"); // Test X-axis pH
  const [yAxisLabel, setYAxisLabel] = useState<string>("Concentration"); // Test Y-axis pH
  const [lineStyle, setLineStyle] = useState<"eckig" | "gerundet">("gerundet");
  const [points, setPoints] = useState<Point[]>([
    { x: 5, y: 10 },
    { x: 6, y: 12 },
    { x: 7.5, y: 18 },
    { x: 8, y: 20 },
    { x: 9, y: 15 }, // Sample data for pH on X
    // To test Y-axis pH: set yAxisLabel to 'pH' and points e.g. [{ x: 10, y: 5 }, { x: 12, y: 8 }]
  ]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false); // Set to false to show graph
  const [hoveredPoint, setHoveredPoint] = useState<Point | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const coordinateSystemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Initialize Groq client
  const groq = new Groq({
    apiKey: import.meta.env.VITE_GROQ_API_KEY || process.env.VITE_GROQ_API_KEY
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setProcessingError(null);
    }
  };

  const processFile = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProcessingError(null);

    try {
      // Datei als Base64 kodieren
      const fileBase64 = await readFileAsBase64(selectedFile);

      // Prepare the prompt
      const prompt = `
        Analysiere die hochgeladene Datei und extrahiere daraus Punkte für ein Koordinatensystem.
        Die X-Achse repräsentiert "${xAxisLabel}" und die Y-Achse repräsentiert "${yAxisLabel}".
        Gib die Punkte als JSON-Array im folgenden Format zurück:
        [{"x": Wert, "y": Wert}, {"x": Wert, "y": Wert}, ...]
        Achte darauf, dass die Werte numerisch sind und keine Strings.
        Gib NUR das JSON-Array zurück, ohne zusätzlichen Text.
      `;

      // Call Groq API
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "image_url",
                image_url: {
                  url: fileBase64
                }
              }
            ]
          }
        ],
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        temperature: 0.2,
        max_completion_tokens: 1024,
        top_p: 0.8,
        stream: false,
        stop: null
      });

      const responseText = chatCompletion.choices[0].message.content;

      if (!responseText) {
        throw new Error("Keine Antwort von der API erhalten");
      }

      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\[.*\]/s);
      if (!jsonMatch) {
        throw new Error("Konnte kein JSON-Array in der Antwort finden");
      }

      const extractedJson = jsonMatch[0];
      const parsedPoints = JSON.parse(extractedJson);

      // Validate the points
      if (!Array.isArray(parsedPoints)) {
        throw new Error("Die API hat kein gültiges Array zurückgegeben");
      }

      const validPoints = parsedPoints.filter(
        (point: any) =>
          typeof point === "object" &&
          point !== null &&
          typeof point.x === "number" &&
          typeof point.y === "number"
      );

      if (validPoints.length === 0) {
        throw new Error("Keine gültigen Punkte gefunden");
      }

      // Sortiere die Punkte nach X-Wert
      validPoints.sort((a, b) => a.x - b.x);

      setPoints(validPoints);
    } catch (error) {
      console.error("Fehler bei der Verarbeitung:", error);
      setProcessingError(
        error instanceof Error
          ? error.message
          : "Unbekannter Fehler bei der Verarbeitung",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Ensure the result is a string
        const result = reader.result as string;
        // If it's already a data URL, use it directly
        if (result.startsWith('data:')) {
          resolve(result);
        } else {
          // Otherwise, convert to a data URL
          const base64 = btoa(
            new Uint8Array(reader.result as ArrayBuffer)
              .reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          resolve(`data:${file.type};base64,${base64}`);
        }
      };
      reader.onerror = (error) => reject(error);
      
      // Read as data URL for images, array buffer for other files
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  };

  const exportAsImage = () => {
    if (!coordinateSystemRef.current || points.length === 0) return;

    try {
      const svgElement = coordinateSystemRef.current.querySelector("svg");
      if (!svgElement) return;

      const clonedSvgElement = svgElement.cloneNode(true) as SVGSVGElement;

      // Function to recursively apply styles
      function inlineStyles(element: Element) {
        const computedStyle = getComputedStyle(element);
        let styleString = "";
        for (let i = 0; i < computedStyle.length; i++) {
          const prop = computedStyle[i];
          styleString += `${prop}:${computedStyle.getPropertyValue(prop)};`;
        }
        element.setAttribute("style", styleString);

        const children = element.children;
        for (let i = 0; i < children.length; i++) {
          inlineStyles(children[i]);
        }
      }

      inlineStyles(clonedSvgElement); // Apply styles to the clone

      // Determine background color based on theme for the SVG itself (fallback, canvas bg is primary)
      const isDarkMode = document.documentElement.classList.contains("dark");
      clonedSvgElement.style.backgroundColor = isDarkMode
        ? "#09090b"
        : "#ffffff";

      const svgData = new XMLSerializer().serializeToString(clonedSvgElement);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) return;

      const rect = svgElement.getBoundingClientRect(); // Use original SVG for size
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Set canvas background based on theme
      ctx.fillStyle = isDarkMode ? "#09090b" : "#ffffff"; // zinc-950 or white
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const img = new Image();
      // Ensure proper encoding for SVG with special characters
      const svgBlob = new Blob([svgData], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        // Exportiere als PNG
        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `${xAxisLabel}-${yAxisLabel}-koordinaten.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      };

      img.src = url;
    } catch (error) {
      console.error("Fehler beim Exportieren als Bild:", error);
      alert("Fehler beim Exportieren als Bild. Bitte versuchen Sie es erneut.");
    }
  };

  const exportAsJson = () => {
    if (points.length === 0) return;

    const data = {
      points,
      xAxisLabel,
      yAxisLabel,
      lineStyle,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "koordinaten-daten.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);

          if (data.points && Array.isArray(data.points)) {
            setPoints(data.points);
            if (data.xAxisLabel) setXAxisLabel(data.xAxisLabel);
            if (data.yAxisLabel) setYAxisLabel(data.yAxisLabel);
            if (data.lineStyle) setLineStyle(data.lineStyle);
          }
        } catch (error) {
          alert(
            "Fehler beim Importieren der Datei. Bitte überprüfen Sie das Format.",
          );
        }
      };

      reader.readAsText(file);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-center">
          Gemini Koordinaten-Visualisierung
        </h1>
        <Button
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          variant="outline"
          size="icon"
        >
          {theme === "light" ? (
            <Moon className="h-[1.2rem] w-[1.2rem]" />
          ) : (
            <Sun className="h-[1.2rem] w-[1.2rem]" />
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Linke Spalte: Einstellungen */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API-Einstellungen</CardTitle>
              <CardDescription>
                Geben Sie Ihren Gemini API-Schlüssel ein
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="apiKey">API-Schlüssel</Label>
                    <div className="relative">
                      <Input
                        id="apiKey"
                        type={showApiKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Gemini API-Schlüssel eingeben"
                        className="pr-10"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3"
                      >
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
                <Button onClick={saveApiKey} className="w-full">
                  Speichern
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Achsenbeschriftung</CardTitle>
              <CardDescription>
                Definieren Sie die Bedeutung der Achsen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="xAxis">X-Achse</Label>
                  <Input
                    id="xAxis"
                    value={xAxisLabel}
                    onChange={(e) => setXAxisLabel(e.target.value)}
                    placeholder="z.B. Zeit, Temperatur, etc."
                  />
                </div>
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="yAxis">Y-Achse</Label>
                  <Input
                    id="yAxis"
                    value={yAxisLabel}
                    onChange={(e) => setYAxisLabel(e.target.value)}
                    placeholder="z.B. Wert, Menge, etc."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Linienoptionen</CardTitle>
              <CardDescription>
                Anpassung der Linienverbindungen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="lineStyle">Linienstil</Label>
                  <Select
                    value={lineStyle}
                    onValueChange={(value) =>
                      setLineStyle(value as "eckig" | "gerundet")
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Linienstil wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gerundet">Gerundet</SelectItem>
                      <SelectItem value="eckig">Eckig</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mittlere Spalte: Koordinatensystem */}
        <div className="md:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Koordinatensystem</CardTitle>
              <CardDescription>
                {hoveredPoint
                  ? `Punkt: X=${hoveredPoint.x.toFixed(2)}, Y=${hoveredPoint.y.toFixed(2)}`
                  : "Bewegen Sie den Mauszeiger über einen Punkt für Details"}
              </CardDescription>
            </CardHeader>
            <CardContent
              className="h-[300px] sm:h-[400px] border rounded-md relative"
              ref={coordinateSystemRef}
            >
              {isProcessing ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-zinc-950">
                  <Loader />
                </div>
              ) : (
                <CoordinateSystem
                  points={points}
                  xAxisLabel={xAxisLabel}
                  yAxisLabel={yAxisLabel}
                  lineStyle={lineStyle}
                  onHoverPoint={setHoveredPoint}
                />
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="flex space-x-2">
                <Button
                  onClick={exportAsImage}
                  variant="outline"
                  size="sm"
                  disabled={points.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Als Bild exportieren
                </Button>
                <Button
                  onClick={exportAsJson}
                  variant="outline"
                  size="sm"
                  disabled={points.length === 0}
                >
                  <Save className="mr-2 h-4 w-4" />
                  JSON exportieren
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Unterer Bereich: Datei-Upload und Import */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Daten verarbeiten</CardTitle>
            <CardDescription>
              Laden Sie Dateien hoch oder importieren Sie vorhandene Daten
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="upload">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">Datei hochladen</TabsTrigger>
                <TabsTrigger value="import">JSON importieren</TabsTrigger>
              </TabsList>
              <TabsContent value="upload" className="space-y-4 mt-4">
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="fileUpload">Datei auswählen</Label>
                  <Input
                    id="fileUpload"
                    type="file"
                    onChange={handleFileChange}
                  />
                  <p className="text-sm text-gray-500">
                    Unterstützte Dateitypen: Bilder, PDFs, Textdateien, Tabellen
                  </p>
                </div>
                <Button
                  onClick={processFile}
                  disabled={!selectedFile || isProcessing || !apiKey}
                  className="w-full"
                >
                  {isProcessing ? "Verarbeite..." : "Mit Gemini verarbeiten"}
                </Button>
                {!apiKey && (
                  <p className="text-sm text-red-500">
                    Bitte geben Sie zuerst einen API-Schlüssel ein
                  </p>
                )}
                {processingError && (
                  <p className="text-sm text-red-500">
                    Fehler: {processingError}
                  </p>
                )}
              </TabsContent>
              <TabsContent value="import" className="space-y-4 mt-4">
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="jsonImport">JSON-Datei auswählen</Label>
                  <Input
                    id="jsonImport"
                    type="file"
                    accept=".json"
                    onChange={importJson}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default App;

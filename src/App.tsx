import { useState, useEffect, useRef } from "react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Sun, Moon, Download, Upload } from "lucide-react";
import { Label } from "./components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Toaster } from "./components/ui/toaster";
import { useToast } from "./components/ui/use-toast";
import "./App.css";

interface Point {
  x: number;
  y: number;
}

function App() {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [xAxisLabel, setXAxisLabel] = useState<string>("X-Axis");
  const [yAxisLabel, setYAxisLabel] = useState<string>("Y-Axis");
  const [lineStyle, setLineStyle] = useState<"eckig" | "gerundet">("gerundet");
  const [points, setPoints] = useState<Point[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const coordinateSystemRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      setSelectedFile(event.target.files[0]);
      setProcessingError(null);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        if (result.startsWith('data:')) {
          resolve(result);
        } else {
          const base64 = btoa(
            new Uint8Array(reader.result as ArrayBuffer)
              .reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          resolve(`data:${file.type};base64,${base64}`);
        }
      };
      reader.onerror = (error) => reject(error);
      
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  };

  const processFile = async () => {
    if (!selectedFile) return;
    
    setIsProcessing(true);
    setProcessingError(null);

    try {
      const base64Data = await readFileAsBase64(selectedFile);
      
      const { text } = await generateText({
        model: groq('meta-llama/llama-4-scout-17b-16e-instruct'),
        messages: [{
          role: 'user',
          content: [
            { 
              type: 'text', 
              text: 'Extract coordinate points from this image and return them as a JSON array of objects with x and y properties. For example: [{"x": 1, "y": 2}, {"x": 3, "y": 4}]. Only return the JSON array, no other text.' 
            },
            { 
              type: 'image', 
              image: base64Data 
            }
          ]
        }]
      });
      
      const jsonMatch = text.match(/\[.*\]/s);
      if (!jsonMatch) {
        throw new Error('No coordinate points found in the response');
      }
      
      const parsedPoints = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(parsedPoints) || 
          !parsedPoints.every((p: any) => 
            typeof p === 'object' && 
            p !== null && 
            typeof p.x === 'number' && 
            typeof p.y === 'number'
          )
      ) {
        throw new Error('Invalid points format');
      }
      
      setPoints(parsedPoints);
      toast({
        title: 'Success',
        description: `Successfully extracted ${parsedPoints.length} points from the image`,
        variant: 'default',
      });
    } catch (error) {
      console.error('Error processing file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process file';
      setProcessingError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const exportAsImage = () => {
    if (!coordinateSystemRef.current) return;

    try {
      const svgElement = coordinateSystemRef.current.querySelector("svg");
      if (!svgElement) return;

      const clonedSvgElement = svgElement.cloneNode(true) as SVGSVGElement;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const svgData = new XMLSerializer().serializeToString(clonedSvgElement);
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `koordinaten-${new Date().toISOString().slice(0, 10)}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      };

      img.onerror = () => {
        setProcessingError("Error exporting image");
      };

      img.src = url;
    } catch (error) {
      console.error("Error exporting image:", error);
      setProcessingError("Error exporting image");
    }
  };

  const exportAsJson = () => {
    if (points.length === 0) return;

    try {
      const data = {
        points,
        xAxisLabel,
        yAxisLabel,
        lineStyle,
      };

      const dataStr = JSON.stringify(data, null, 2);
      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
      const exportName = `koordinaten-${new Date().toISOString().slice(0, 10)}.json`;

      const linkElement = document.createElement("a");
      linkElement.setAttribute("href", dataUri);
      linkElement.setAttribute("download", exportName);
      linkElement.click();
    } catch (error) {
      console.error("Error exporting JSON:", error);
      setProcessingError("Error exporting JSON");
    }
  };

  const importJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.points && Array.isArray(data.points)) {
          setPoints(data.points);
          if (data.xAxisLabel) setXAxisLabel(data.xAxisLabel);
          if (data.yAxisLabel) setYAxisLabel(data.yAxisLabel);
          if (data.lineStyle) setLineStyle(data.lineStyle);
          setProcessingError(null);
          toast({
            title: 'Success',
            description: `Successfully imported ${data.points.length} points`,
            variant: 'default',
          });
        } else {
          throw new Error("Invalid file format");
        }
      } catch (error) {
        console.error("Error importing JSON:", error);
        setProcessingError("Error importing JSON file");
      }
    };
    reader.onerror = () => setProcessingError("Error reading file");
    reader.readAsText(file);
  };

  const triggerFileInput = () => fileInputRef.current?.click();
  const triggerJsonInput = () => jsonInputRef.current?.click();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between px-4">
          <h1 className="text-xl font-semibold">Coordinate Extractor</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      <main className="container py-8">
        <Tabs defaultValue="extract" className="space-y-4">
          <TabsList>
            <TabsTrigger value="extract">Extract Coordinates</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="extract" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Extract Coordinates from Image</CardTitle>
                <CardDescription>
                  Upload an image containing a graph or plot to extract coordinate points.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <Button onClick={triggerFileInput}>
                      <Upload className="mr-2 h-4 w-4" />
                      Select Image
                    </Button>
                    {selectedFile && (
                      <span className="text-sm text-muted-foreground">
                        {selectedFile.name}
                      </span>
                    )}
                  </div>
                  <Button 
                    onClick={processFile} 
                    disabled={!selectedFile || isProcessing}
                  >
                    {isProcessing ? 'Processing...' : 'Extract Coordinates'}
                  </Button>
                </div>

                {processingError && (
                  <div className="text-destructive text-sm">
                    Error: {processingError}
                  </div>
                )}

                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Extracted Points</h3>
                    <div className="space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={exportAsImage}
                        disabled={points.length === 0}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export as Image
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={exportAsJson}
                        disabled={points.length === 0}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export as JSON
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={triggerJsonInput}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Import JSON
                        <Input
                          type="file"
                          ref={jsonInputRef}
                          onChange={importJson}
                          accept=".json"
                          className="hidden"
                        />
                      </Button>
                    </div>
                  </div>
                  
                  {points.length > 0 ? (
                    <div className="mt-2 rounded-md border p-4 font-mono text-sm">
                      <pre>{JSON.stringify(points, null, 2)}</pre>
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-muted-foreground">
                      No points extracted yet. Upload an image to get started.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
                <CardDescription>
                  Configure the coordinate system settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="xAxisLabel">X-Axis Label</Label>
                    <Input
                      id="xAxisLabel"
                      value={xAxisLabel}
                      onChange={(e) => setXAxisLabel(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="yAxisLabel">Y-Axis Label</Label>
                    <Input
                      id="yAxisLabel"
                      value={yAxisLabel}
                      onChange={(e) => setYAxisLabel(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lineStyle">Line Style</Label>
                    <Select
                      value={lineStyle}
                      onValueChange={(value: "eckig" | "gerundet") => setLineStyle(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select line style" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gerundet">Smooth</SelectItem>
                        <SelectItem value="eckig">Sharp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <Toaster />
    </div>
  );
}

export default App;

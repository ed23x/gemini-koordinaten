import React, { useRef, useEffect, useState } from 'react';
import { LineChart } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface CoordinateSystemProps {
  points: Point[];
  xAxisLabel: string;
  yAxisLabel: string;
  lineStyle: 'eckig' | 'gerundet';
  onHoverPoint: (point: Point | null) => void;
}

const CoordinateSystem: React.FC<CoordinateSystemProps> = ({
  points,
  xAxisLabel,
  yAxisLabel,
  lineStyle,
  onHoverPoint
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState({ x: 1, y: 1 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const padding = { left: 50, right: 20, top: 20, bottom: 50 };

  // Berechne die Dimensionen und Skalierung beim ersten Rendern und bei Größenänderungen
  useEffect(() => {
    if (!containerRef.current || points.length === 0) return;

    const updateDimensions = () => {
      if (!containerRef.current) return;
      
      const { width, height } = containerRef.current.getBoundingClientRect();
      setDimensions({ width, height });

      // Finde Min/Max-Werte für X und Y
      const xValues = points.map(p => p.x);
      const yValues = points.map(p => p.y);
      const minX = Math.min(...xValues);
      const maxX = Math.max(...xValues);
      const minY = Math.min(...yValues);
      const maxY = Math.max(...yValues);

      // Berechne Skalierungsfaktoren
      const xRange = maxX - minX || 1; // Verhindere Division durch 0
      const yRange = maxY - minY || 1;
      
      const xScale = (width - padding.left - padding.right) / xRange;
      const yScale = (height - padding.top - padding.bottom) / yRange;

      setScale({ x: xScale, y: yScale });
      setOffset({ x: minX, y: minY });
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);

    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
    };
  }, [points, containerRef.current]);

  // Konvertiere Datenpunkte in Bildschirmkoordinaten
  const getScreenCoordinates = (point: Point) => {
    const x = ((point.x - offset.x) * scale.x) + padding.left;
    // Y-Achse ist umgekehrt im Bildschirm-Koordinatensystem
    const y = dimensions.height - (((point.y - offset.y) * scale.y) + padding.bottom);
    return { x, y };
  };

  // Generiere SVG-Pfad für die Linien
  const generatePath = () => {
    if (points.length < 2) return '';

    const screenPoints = points.map(getScreenCoordinates);
    
    if (lineStyle === 'eckig') {
      // Eckige Linien (Polyline)
      return screenPoints.map((p, i) => 
        i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
      ).join(' ');
    } else {
      // Gerundete Linien (Bezier-Kurven)
      let path = `M ${screenPoints[0].x} ${screenPoints[0].y}`;
      
      for (let i = 0; i < screenPoints.length - 1; i++) {
        const current = screenPoints[i];
        const next = screenPoints[i + 1];
        const midX = (current.x + next.x) / 2;
        
        path += ` C ${midX} ${current.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
      }
      
      return path;
    }
  };

  // Behandle Mausbewegung über Punkte
  const handlePointHover = (index: number) => {
    setHoveredPointIndex(index);
    onHoverPoint(points[index]);
    
    if (containerRef.current) {
      const screenPoint = getScreenCoordinates(points[index]);
      setTooltipPos({ x: screenPoint.x, y: screenPoint.y - 20 });
    }
  };

  const handlePointLeave = () => {
    setHoveredPointIndex(null);
    onHoverPoint(null);
  };

  // Generiere Achsenbeschriftungen und Markierungen
  const generateAxisLabels = () => {
    if (points.length === 0) return null;

    const xValues = points.map(p => p.x);
    const yValues = points.map(p => p.y);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    // Erzeuge X-Achsen-Markierungen (5 Markierungen)
    const xTicks = [];
    for (let i = 0; i <= 4; i++) {
      const value = minX + (maxX - minX) * (i / 4);
      const screenX = ((value - offset.x) * scale.x) + padding.left;
      const screenY = dimensions.height - padding.bottom + 15;
      
      xTicks.push(
        <g key={`x-tick-${i}`}>
          <line 
            x1={screenX} 
            y1={dimensions.height - padding.bottom} 
            x2={screenX} 
            y2={dimensions.height - padding.bottom + 5} 
            stroke="#6b7280" 
            strokeWidth="1" 
          />
          <text 
            x={screenX} 
            y={screenY} 
            textAnchor="middle" 
            fontSize="10" 
            fill="#6b7280"
          >
            {value.toFixed(1)}
          </text>
        </g>
      );
    }

    // Erzeuge Y-Achsen-Markierungen (5 Markierungen)
    const yTicks = [];
    for (let i = 0; i <= 4; i++) {
      const value = minY + (maxY - minY) * (i / 4);
      const screenX = padding.left - 10;
      const screenY = dimensions.height - (((value - offset.y) * scale.y) + padding.bottom);
      
      yTicks.push(
        <g key={`y-tick-${i}`}>
          <line 
            x1={padding.left - 5} 
            y1={screenY} 
            x2={padding.left} 
            y2={screenY} 
            stroke="#6b7280" 
            strokeWidth="1" 
          />
          <text 
            x={screenX} 
            y={screenY} 
            textAnchor="end" 
            dominantBaseline="middle" 
            fontSize="10" 
            fill="#6b7280"
          >
            {value.toFixed(1)}
          </text>
        </g>
      );
    }

    return (
      <>
        {xTicks}
        {yTicks}
        <text 
          x={dimensions.width - padding.right} 
          y={dimensions.height - padding.bottom / 2} 
          textAnchor="end" 
          fontSize="12" 
          fill="#6b7280"
        >
          {xAxisLabel}
        </text>
        <text 
          x={padding.left / 2} 
          y={padding.top} 
          textAnchor="middle" 
          fontSize="12" 
          fill="#6b7280"
          transform={`rotate(-90, ${padding.left / 2}, ${padding.top})`}
          dominantBaseline="hanging"
        >
          {yAxisLabel}
        </text>
      </>
    );
  };

  if (points.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <LineChart className="mx-auto h-12 w-12 opacity-50" />
          <p className="mt-2">Laden Sie eine Datei hoch oder importieren Sie JSON-Daten, um Punkte anzuzeigen</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="coordinate-system w-full h-full">
      {dimensions.width > 0 && dimensions.height > 0 && (
        <svg width="100%" height="100%">
          {/* Achsen */}
          <line 
            x1={padding.left} 
            y1={dimensions.height - padding.bottom} 
            x2={dimensions.width - padding.right} 
            y2={dimensions.height - padding.bottom} 
            stroke="#6b7280" 
            strokeWidth="1" 
          />
          <line 
            x1={padding.left} 
            y1={padding.top} 
            x2={padding.left} 
            y2={dimensions.height - padding.bottom} 
            stroke="#6b7280" 
            strokeWidth="1" 
          />
          
          {/* Achsenbeschriftungen */}
          {generateAxisLabels()}
          
          {/* Verbindungslinien */}
          {points.length > 1 && (
            <path 
              d={generatePath()} 
              fill="none" 
              stroke="#3b82f6" 
              strokeWidth="2" 
              strokeOpacity="0.7" 
            />
          )}
          
          {/* Punkte */}
          {points.map((point, index) => {
            const { x, y } = getScreenCoordinates(point);
            return (
              <circle 
                key={index}
                cx={x}
                cy={y}
                r={hoveredPointIndex === index ? 6 : 4}
                fill={hoveredPointIndex === index ? "#2563eb" : "#3b82f6"}
                stroke="#fff"
                strokeWidth="1"
                onMouseEnter={() => handlePointHover(index)}
                onMouseLeave={handlePointLeave}
                style={{ cursor: 'pointer', transition: 'r 0.2s ease' }}
              />
            );
          })}
          
          {/* Tooltip */}
          {hoveredPointIndex !== null && (
            <g>
              <rect
                x={tooltipPos.x - 50}
                y={tooltipPos.y - 25}
                width="100"
                height="20"
                rx="4"
                fill="rgba(0, 0, 0, 0.8)"
              />
              <text
                x={tooltipPos.x}
                y={tooltipPos.y - 15}
                textAnchor="middle"
                fill="#fff"
                fontSize="10"
              >
                X: {points[hoveredPointIndex].x.toFixed(2)}, Y: {points[hoveredPointIndex].y.toFixed(2)}
              </text>
            </g>
          )}
        </svg>
      )}
    </div>
  );
};

export default CoordinateSystem;

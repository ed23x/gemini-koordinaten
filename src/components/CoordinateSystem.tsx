import React, { useRef, useEffect, useState } from 'react';
import { LineChart } from 'lucide-react';
import { useIsMobile } from '../hooks/use-mobile'; // Assuming this is the correct path

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
  const [intersectPoint, setIntersectPoint] = useState<{ xVal: number; yVal: number } | null>(null);
  const [initialView, setInitialView] = useState<{ scale: { x: number; y: number }; offset: { x: number; y: number } } | null>(null);
  const [clickedAxisInfo, setClickedAxisInfo] = useState<{
    axis: 'x' | 'y';
    value: number;
    screenPos: { x: number; y: number };
    intersectOnGraph: { x: number; y: number };
    otherAxisValue: number;
  } | null>(null);

  const isMobile = useIsMobile();

  const padding = React.useMemo(() => {
    return isMobile
        ? { left: 35, right: 15, top: 15, bottom: 35 }
        : { left: 50, right: 20, top: 20, bottom: 50 };
  }, [isMobile]);

  const handleWheelZoom = React.useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!containerRef.current || !dimensions.width || !dimensions.height || !initialView) return;
    event.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const dataXBeforeZoom = (mouseX - padding.left) / scale.x + offset.x;
    const dataYBeforeZoom = (dimensions.height - mouseY - padding.bottom) / scale.y + offset.y;

    const zoomIntensity = 0.1;
    let newScaleX = scale.x * (1 - event.deltaY * zoomIntensity * 0.01);
    let newScaleY = scale.y * (1 - event.deltaY * zoomIntensity * 0.01);

    const minZoomFactor = 0.5;
    const maxZoomFactor = 20;

    newScaleX = Math.max(initialView.scale.x * minZoomFactor, Math.min(initialView.scale.x * maxZoomFactor, newScaleX));
    newScaleY = Math.max(initialView.scale.y * minZoomFactor, Math.min(initialView.scale.y * maxZoomFactor, newScaleY));

    const newOffsetX = dataXBeforeZoom - (mouseX - padding.left) / newScaleX;
    const newOffsetY = dataYBeforeZoom - (dimensions.height - mouseY - padding.bottom) / newScaleY;

    setScale({ x: newScaleX, y: newScaleY });
    setOffset({ x: newOffsetX, y: newOffsetY });
    setClickedAxisInfo(null);
    if (hoveredPointIndex !== null) {
        onHoverPoint(null);
        setHoveredPointIndex(null);
    }
  }, [scale, offset, dimensions, padding, initialView, hoveredPointIndex, onHoverPoint]);

  const phInfo = React.useMemo(() => {
    const xIsPh = xAxisLabel.toLowerCase().includes('ph');
    const yIsPh = yAxisLabel.toLowerCase().includes('ph');
    if (xIsPh) return { axis: 'x', label: xAxisLabel };
    if (yIsPh) return { axis: 'y', label: yAxisLabel };
    return null;
  }, [xAxisLabel, yAxisLabel]);

  // Helper function for interpolation
  // Wrapped in useCallback to stabilize its reference for useEffect dependencies
  const interpolateValue = React.useCallback((
    targetAxisValue: number,
    isXAxisTarget: boolean, // True if targetAxisValue is on X-axis, false for Y-axis
    sortedPoints: Point[]
  ): { mainAxisVal: number; otherAxisVal: number } | null => {
    if (sortedPoints.length < 1) return null;
    // If only one point, check if it matches the target.
    if (sortedPoints.length === 1) {
      const p = sortedPoints[0];
      if (isXAxisTarget && p.x === targetAxisValue) return { mainAxisVal: p.x, otherAxisVal: p.y };
      if (!isXAxisTarget && p.y === targetAxisValue) return { mainAxisVal: p.y, otherAxisVal: p.x };
      return null;
    }


    for (let i = 0; i < sortedPoints.length; i++) {
      const p1 = sortedPoints[i];
      const p2 = sortedPoints[i + 1];

      const p1Main = isXAxisTarget ? p1.x : p1.y;
      const p1Other = isXAxisTarget ? p1.y : p1.x;

      // Exact match on a point
      if (p1Main === targetAxisValue) {
        return { mainAxisVal: p1Main, otherAxisVal: p1Other };
      }

      if (!p2) continue; // End of array

      const p2Main = isXAxisTarget ? p2.x : p2.y;
      const p2Other = isXAxisTarget ? p2.y : p2.x;

      // Interpolation between p1 and p2
      if ((p1Main < targetAxisValue && p2Main > targetAxisValue) || (p1Main > targetAxisValue && p2Main < targetAxisValue)) {
        if (p2Main - p1Main === 0) { // Avoid division by zero - segment is parallel to other axis
          // This means multiple points have the same mainAxisVal, effectively a line.
          // For simplicity, return the first one found. Could also average, or indicate ambiguity.
          return { mainAxisVal: targetAxisValue, otherAxisVal: p1Other };
        }
        const interpolatedOther = p1Other + (p2Other - p1Other) * (targetAxisValue - p1Main) / (p2Main - p1Main);
        return { mainAxisVal: targetAxisValue, otherAxisVal: interpolatedOther };
      }
    }
     // Check last point for exact match if not covered by loop
    const lastPoint = sortedPoints[sortedPoints.length -1];
    const lastPointMain = isXAxisTarget ? lastPoint.x : lastPoint.y;
    const lastPointOther = isXAxisTarget ? lastPoint.y : lastPoint.x;
    if (lastPointMain === targetAxisValue) {
        return { mainAxisVal: lastPointMain, otherAxisVal: lastPointOther };
    }

    return null; // Target value is outside the range of the provided points
  }, []); // No dependencies from component scope other than its arguments


  // Berechne die Dimensionen und Skalierung beim ersten Rendern und bei Größenänderungen
  useEffect(() => {
    if (!containerRef.current) return; // Allow effect to run even with 0 points to set dimensions

    // Reset indicators if points are empty
    if (points.length === 0) {
      setIntersectPoint(null);
      setClickedAxisInfo(null);
      // Optionally reset zoom/pan here or provide a default view:
      // setScale({ x: 1, y: 1 });
      // setOffset({ x: 0, y: 0 });
      // setInitialView({ scale: {x:1, y:1}, offset: {x:0, y:0}});
      return;
    }

    const updateDimensions = () => {
      if (!containerRef.current) return;
      
      const { width, height } = containerRef.current.getBoundingClientRect();
      setDimensions({ width, height });

      // Dynamische Anpassung des Paddings hier, falls erforderlich, wenn sich die Dimensionen ändern
      // Für dieses Beispiel bleibt das Padding initial basierend auf isMobile gesetzt.
      // Eine komplexere Lösung könnte das Padding hier basierend auf width/height neu berechnen.

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

      const newScale = { x: xScale, y: yScale };
      const newOffset = { x: minX, y: minY };

      setScale(newScale);
      setOffset(newOffset);
      if (!initialView) { // Store the initial view for reset
        setInitialView({ scale: newScale, offset: newOffset });
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);

    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
    };
  }, [points, padding, initialView]); // Removed containerRef.current from deps, it's a ref.

  useEffect(() => {
    if (!phInfo || points.length < 2) { // pH line requires at least 2 points for interpolation
      setIntersectPoint(null);
      return;
    }

    const xValues = points.map(p => p.x);
    const yValues = points.map(p => p.y);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    let newIntersectPointData: { xVal: number; yVal: number } | null = null;
    // Calculate pH intersection point
    if (phInfo && points.length >= 1) { // interpolateValue can handle 1 point for exact match
      if (phInfo.axis === 'x' && 7 >= minX && 7 <= maxX) {
        const sortedByX = [...points].sort((a, b) => a.x - b.x);
        const result = interpolateValue(7, true, sortedByX);
        if (result) {
          newIntersectPointData = { xVal: result.mainAxisVal, yVal: result.otherAxisVal };
        }
      } else if (phInfo.axis === 'y' && 7 >= minY && 7 <= maxY) {
        const sortedByY = [...points].sort((a, b) => a.y - b.y);
        const result = interpolateValue(7, false, sortedByY);
        if (result) {
          newIntersectPointData = { xVal: result.otherAxisVal, yVal: result.mainAxisVal };
        }
      }
    }
    setIntersectPoint(newIntersectPointData);
  }, [points, phInfo, xAxisLabel, yAxisLabel, interpolateValue]);

    // Konvertiere Datenpunkte in Bildschirmkoordinaten
  const getScreenCoordinates = React.useCallback((point: Point) => {
    const x = ((point.x - offset.x) * scale.x) + padding.left;
    // Y-Achse ist umgekehrt im Bildschirm-Koordinatensystem
    const y = dimensions.height - (((point.y - offset.y) * scale.y) + padding.bottom);
    return { x, y };
  }, [scale, offset, dimensions, padding]); // Added dependencies

  // Generiere SVG-Pfad für die Linien
  const generatePath = React.useCallback(() => {
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
  }, [points, getScreenCoordinates, lineStyle]); // Added dependencies

  // Behandle Punktinteraktion (Hover oder Klick/Touch)
  const handlePointInteraction = React.useCallback((index: number | null) => {
    if (index === null) {
      setHoveredPointIndex(null);
      onHoverPoint(null);
      return;
    }
    setHoveredPointIndex(index);
    onHoverPoint(points[index]);
    
    if (containerRef.current) { // containerRef.current can be null if component unmounts
      const screenPoint = getScreenCoordinates(points[index]);
      const yOffset = isMobile ? -30 : -20; // Tooltip weiter oben auf Mobilgeräten
      setTooltipPos({ x: screenPoint.x, y: screenPoint.y + yOffset });
    }
  }, [points, getScreenCoordinates, onHoverPoint, isMobile, setHoveredPointIndex, setTooltipPos]); // Added dependencies

  const handleSvgClick = React.useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    let targetIsTick = false;
    if (event.target instanceof SVGTextElement && event.target.classList.contains('axis-tick-value')) {
      targetIsTick = true;
    }

    if (event.target === event.currentTarget && !targetIsTick) {
      handlePointInteraction(null); // Dismiss point tooltip
      setClickedAxisInfo(null);     // Dismiss clicked axis info
    }
  }, [handlePointInteraction, setClickedAxisInfo]); // Added dependencies

  const handleAxisTickClick = React.useCallback((axis: 'x' | 'y', value: number) => {
     // Axis click requires at least 1 point for exact match, 2 for interpolation via interpolateValue
    if (points.length < 1) {
      setClickedAxisInfo(null);
      return;
    }

    let graphIntersectDataResult: { mainAxisVal: number; otherAxisVal: number } | null = null;

    if (axis === 'x') {
      const sortedByX = [...points].sort((a,b) => a.x - b.x);
      graphIntersectDataResult = interpolateValue(value, true, sortedByX);
    } else { // axis === 'y'
      const sortedByY = [...points].sort((a,b) => a.y - b.y);
      graphIntersectDataResult = interpolateValue(value, false, sortedByY);
    }

    if (graphIntersectDataResult) {
      const graphIntersectData = axis === 'x'
        ? { x: graphIntersectDataResult.mainAxisVal, y: graphIntersectDataResult.otherAxisVal }
        : { x: graphIntersectDataResult.otherAxisVal, y: graphIntersectDataResult.mainAxisVal };

      const otherValue = graphIntersectDataResult.otherAxisVal;

      const screenPos = axis === 'x'
        ? { x: getScreenCoordinates({ x: value, y: offset.y }).x, y: dimensions.height - padding.bottom } // y: offset.y is arbitrary for screen X calc
        : { x: padding.left, y: getScreenCoordinates({ x: offset.x, y: value }).y };

      setClickedAxisInfo({
        axis: axis,
        value: value,
        screenPos: screenPos,
        intersectOnGraph: graphIntersectData,
        otherAxisValue: otherValue,
      });
      handlePointInteraction(null); // Clear point tooltip
    } else {
      setClickedAxisInfo(null);
    }
  }, [points, interpolateValue, getScreenCoordinates, offset, dimensions, padding, handlePointInteraction, setClickedAxisInfo]); // Added dependencies


  // Generiere Achsenbeschriftungen und Markierungen
  const generateAxisLabels = React.useCallback(() => {
    if (!dimensions.width || !dimensions.height || points.length === 0) return null;

    const calculateNiceTicks = (visibleMin: number, visibleMax: number) => {
      const range = visibleMax - visibleMin;
      if (range === 0 && Number.isFinite(visibleMin)) return [{ value: visibleMin }];
      if (!Number.isFinite(range) || range === 0) return [];


      const numTicksTarget = isMobile ? 3 : 5;
      let rawTickStep = range / numTicksTarget;

      const exponent = Math.floor(Math.log10(rawTickStep));
      const mantissa = rawTickStep / Math.pow(10, exponent);

      let niceMantissa;
      if (mantissa < 1.5) niceMantissa = 1;
      else if (mantissa < 3.5) niceMantissa = 2;
      else if (mantissa < 7.5) niceMantissa = 5;
      else niceMantissa = 10;

      const niceTickStep = niceMantissa * Math.pow(10, exponent);

      const firstTick = Math.ceil(visibleMin / niceTickStep) * niceTickStep;
      const lastTick = Math.floor(visibleMax / niceTickStep) * niceTickStep;

      const ticks = [];
      if(niceTickStep === 0) return [{value: firstTick}]; // Avoid infinite loop if step is 0

      for (let value = firstTick; value <= lastTick + niceTickStep * 0.5; value += niceTickStep) {
         // Add small epsilon to include lastTick if it's a float precision issue
        ticks.push({ value });
      }
      return ticks;
    };

    const formatTickValue = (value: number, niceTickStep: number) => {
      if (niceTickStep === 0 || !Number.isFinite(value)) return value.toString();
      const absoluteNiceTickStep = Math.abs(niceTickStep);
      if (absoluteNiceTickStep < 1) {
        if (absoluteNiceTickStep < 0.01) return value.toFixed(3);
        if (absoluteNiceTickStep < 0.1) return value.toFixed(2);
        return value.toFixed(1);
      }
      return value.toFixed(0);
    };


    // Calculate visible data range
    const visibleMinX = offset.x;
    const visibleMaxX = offset.x + (dimensions.width - padding.left - padding.right) / scale.x;
    const xTickValues = calculateNiceTicks(visibleMinX, visibleMaxX);
    const xNiceTickStep = xTickValues.length > 1 ? Math.abs(xTickValues[1].value - xTickValues[0].value) : (xTickValues.length === 1 && xTickValues[0] ? Math.abs(xTickValues[0].value / 2) || 1 : 1) ;


    const xTicks = xTickValues.map(({ value }, i) => {
      const screenX = ((value - offset.x) * scale.x) + padding.left;
      if (screenX < padding.left - 5 || screenX > dimensions.width - padding.right + 5) return null;
      const screenY = dimensions.height - padding.bottom + (isMobile ? 10 : 15);
      const formattedValue = formatTickValue(value, xNiceTickStep);
      
      return (
        <g key={`x-tick-${i}`}>
          <line 
            x1={screenX} 
            y1={dimensions.height - padding.bottom} 
            x2={screenX} 
            y2={dimensions.height - padding.bottom + 5} 
            strokeWidth="1"
            className="stroke-gray-500 dark:stroke-gray-400"
          />
          <text 
            x={screenX} 
            y={screenY} 
            textAnchor="middle"
            className={`fill-gray-500 dark:fill-gray-400 text-[8px] sm:text-[10px] axis-tick-value ${Number.isInteger(parseFloat(formattedValue)) && formattedValue.indexOf('.') === -1 ? 'cursor-pointer' : ''}`}
            onClick={() => Number.isInteger(parseFloat(formattedValue)) && formattedValue.indexOf('.') === -1 && handleAxisTickClick('x', parseFloat(formattedValue))}
          >
            {formattedValue}
          </text>
        </g>
      );
    }).filter(Boolean);

    const visibleMinY = offset.y;
    const visibleMaxY = offset.y + (dimensions.height - padding.top - padding.bottom) / scale.y;
    const yTickValues = calculateNiceTicks(visibleMinY, visibleMaxY);
    const yNiceTickStep = yTickValues.length > 1 ? Math.abs(yTickValues[1].value - yTickValues[0].value) : (yTickValues.length === 1 && yTickValues[0] ? Math.abs(yTickValues[0].value / 2) || 1 : 1);


    const yTicks = yTickValues.map(({ value }, i) => {
      const screenY = dimensions.height - (((value - offset.y) * scale.y) + padding.bottom);
      if (screenY < padding.top - 5 || screenY > dimensions.height - padding.bottom + 5) return null;
      const screenX = padding.left - (isMobile ? 8 : 10);
      const formattedValue = formatTickValue(value, yNiceTickStep);
      
      return (
        <g key={`y-tick-${i}`}>
          <line 
            x1={padding.left - 5} 
            y1={screenY} 
            x2={padding.left} 
            y2={screenY} 
            strokeWidth="1"
            className="stroke-gray-500 dark:stroke-gray-400"
          />
          <text 
            x={screenX} 
            y={screenY} 
            textAnchor="end" 
            dominantBaseline="middle"
            className={`fill-gray-500 dark:fill-gray-400 text-[8px] sm:text-[10px] axis-tick-value ${Number.isInteger(parseFloat(formattedValue)) && formattedValue.indexOf('.') === -1 ? 'cursor-pointer' : ''}`}
            onClick={() => Number.isInteger(parseFloat(formattedValue)) && formattedValue.indexOf('.') === -1 && handleAxisTickClick('y', parseFloat(formattedValue))}
          >
            {formattedValue}
          </text>
        </g>
      );
    }).filter(Boolean);

    return (
      <>
        {xTicks}
        {yTicks}
        <text 
          x={dimensions.width - padding.right} 
          y={dimensions.height - padding.bottom / 2} 
          textAnchor="end"
          className="fill-gray-500 dark:fill-gray-400 text-xs sm:text-sm"
        >
          {xAxisLabel}
        </text>
        <text 
          x={padding.left / 2} 
          y={padding.top - (isMobile ? 5 : 0) } // Adjust y position for mobile to prevent overlap
          textAnchor="middle"
          className="fill-gray-500 dark:fill-gray-400 text-xs sm:text-sm"
          transform={`rotate(-90, ${padding.left / 2}, ${padding.top})`}
          dominantBaseline="hanging"
        >
          {yAxisLabel}
        </text>
      </>
    );
  }, [dimensions, points, scale, offset, padding, isMobile, xAxisLabel, yAxisLabel, handleAxisTickClick]); // Added dependencies

  if (points.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <LineChart className="mx-auto h-12 w-12 opacity-50" />
          <p className="mt-2">Laden Sie eine Datei hoch oder importieren Sie JSON-Daten, um Punkte anzuzeigen</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="coordinate-system w-full h-full touch-pan-y" // Allow vertical scrolling on touch
      onClick={(e) => {
        if (e.target === containerRef.current) {
           handlePointInteraction(null); // Clear point tooltip
           setClickedAxisInfo(null);     // Clear clicked axis info
        }
      }}
      onWheel={handleWheelZoom}
    >
      {dimensions.width > 0 && dimensions.height > 0 && (
        <svg width="100%" height="100%" onClick={handleSvgClick}>
          {/* Achsen */}
          <line 
            x1={padding.left} 
            y1={dimensions.height - padding.bottom} 
            x2={dimensions.width - padding.right} 
            y2={dimensions.height - padding.bottom} 
            strokeWidth="1"
            className="stroke-gray-500 dark:stroke-gray-400"
          />
          <line 
            x1={padding.left} 
            y1={padding.top} 
            x2={padding.left} 
            y2={dimensions.height - padding.bottom} 
            strokeWidth="1"
            className="stroke-gray-500 dark:stroke-gray-400"
          />
          
          {/* Achsenbeschriftungen */}
          {generateAxisLabels()}
          
          {/* Verbindungslinien */}
          {points.length > 1 && (
            <path 
              d={generatePath()} 
              fill="none"
              className="stroke-blue-500 dark:stroke-blue-400"
              strokeWidth="2" 
              strokeOpacity="0.7" 
            />
          )}
          
          {/* Punkte */}
          {points.map((point, index) => {
            const { x, y } = getScreenCoordinates(point);
            // Basic check to see if point is within visible range before rendering
            if (x < padding.left -5 || x > dimensions.width - padding.right + 5 || y < padding.top -5 || y > dimensions.height - padding.bottom + 5) {
                 // Add some tolerance (+5 / -5) to render points slightly outside strict bounds, looks better during pan
                return null;
            }
            const pointRadius = isMobile ? (hoveredPointIndex === index ? 8 : 6) : (hoveredPointIndex === index ? 6 : 4);
            return (
              <g key={index} onClick={() => handlePointInteraction(index)} onTouchStart={() => handlePointInteraction(index)}>
                {isMobile && ( // Invisible larger circle for easier tapping on mobile
                  <circle
                    cx={x}
                    cy={y}
                    r={pointRadius + 10} // Larger tap area
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={pointRadius}
                  className={
                    hoveredPointIndex === index
                      ? "fill-blue-600 dark:fill-blue-500 stroke-white dark:stroke-zinc-950"
                      : "fill-blue-500 dark:fill-blue-400 stroke-white dark:stroke-zinc-950"
                  }
                  strokeWidth="1"
                  onMouseEnter={() => !isMobile && handlePointInteraction(index)} // Only use mouseEnter on non-mobile
                  onMouseLeave={() => !isMobile && handlePointInteraction(null)}   // Only use mouseLeave on non-mobile
                  style={{ cursor: 'pointer', transition: 'r 0.2s ease' }}
                />
              </g>
            );
          })}
          
          {/* Tooltip */}
          {hoveredPointIndex !== null && points[hoveredPointIndex] && (
            <g>
              <rect
                x={tooltipPos.x - 50}
                y={tooltipPos.y - 25}
                width="100"
                height="20"
                rx="4"
                className="fill-gray-900/80 dark:fill-gray-700/80"
              />
              <text
                x={tooltipPos.x}
                y={tooltipPos.y + (isMobile ? 10 : -15)} // Adjust y position for mobile
                textAnchor="middle"
                className="fill-white dark:fill-gray-100 text-[10px] sm:text-xs"
              >
                X: {points[hoveredPointIndex].x.toFixed(2)}, Y: {points[hoveredPointIndex].y.toFixed(2)}
              </text>
            </g>
          )}

          {/* pH Indicator Lines and Text */}
          {phInfo && intersectPoint && dimensions.width > 0 && dimensions.height > 0 && (
            <g className="ph-indicator">
              {(() => {
                const screenIntersect = getScreenCoordinates({ x: intersectPoint.xVal, y: intersectPoint.yVal });
                // Basic check to see if intersection is visible
                if (screenIntersect.x < padding.left || screenIntersect.x > dimensions.width - padding.right ||
                    screenIntersect.y < padding.top || screenIntersect.y > dimensions.height - padding.bottom) {
                    // return null; // Don't render if intersection is off-screen - allow lines to extend
                }

                let ph7OnAxisScreenX, ph7OnAxisScreenY, valueOnOtherAxisScreenX, valueOnOtherAxisScreenY;

                if (phInfo.axis === 'x') {
                  ph7OnAxisScreenX = screenIntersect.x;
                  ph7OnAxisScreenY = dimensions.height - padding.bottom;
                  valueOnOtherAxisScreenX = padding.left;
                  valueOnOtherAxisScreenY = screenIntersect.y;
                } else {
                  ph7OnAxisScreenX = padding.left;
                  ph7OnAxisScreenY = screenIntersect.y;
                  valueOnOtherAxisScreenX = screenIntersect.x;
                  valueOnOtherAxisScreenY = dimensions.height - padding.bottom + (isMobile ? 10 : 15);
                }

                // The clamping logic using the variables below was not being applied to the <line> elements.
                // The lines are drawn using ph7OnAxisScreenX/Y and screenIntersect directly.
                // These variables are therefore unused and are removed to fix TS6133.
                // const lineToGraphStartX = Math.max(padding.left, Math.min(ph7OnAxisScreenX, dimensions.width - padding.right));
                // const lineToGraphStartY = Math.max(padding.top, Math.min(ph7OnAxisScreenY, dimensions.height - padding.bottom));
                // const lineToGraphEndX = Math.max(padding.left, Math.min(screenIntersect.x, dimensions.width - padding.right));
                // const lineToGraphEndY = Math.max(padding.top, Math.min(screenIntersect.y, dimensions.height - padding.bottom));
                // const lineToOtherAxisEndX = phInfo.axis === 'x' ? padding.left : lineToGraphEndX;
                // const lineToOtherAxisEndY = phInfo.axis === 'x' ? lineToGraphEndY : dimensions.height - padding.bottom;
                return (
                  <>
                    {/* Line from pH axis to graph line */}
                    <line
                      x1={ph7OnAxisScreenX}
                      y1={ph7OnAxisScreenY}
                      x2={screenIntersect.x}
                      y2={screenIntersect.y}
                      className="stroke-red-500 dark:stroke-red-400"
                      strokeWidth="1"
                      strokeDasharray="4 2"
                    />
                    {/* Line from graph line to other axis */}
                    <line
                      x1={screenIntersect.x}
                      y1={screenIntersect.y}
                      x2={phInfo.axis === 'x' ? padding.left : screenIntersect.x}
                      y2={phInfo.axis === 'x' ? screenIntersect.y : dimensions.height - padding.bottom}
                      className="stroke-red-500 dark:stroke-red-400"
                      strokeWidth="1"
                      strokeDasharray="4 2"
                    />
                    {/* Text displaying the other axis value */}
                    {(phInfo.axis === 'x' && valueOnOtherAxisScreenY >= padding.top && valueOnOtherAxisScreenY <= dimensions.height-padding.bottom) ||
                     (phInfo.axis === 'y' && valueOnOtherAxisScreenX >= padding.left && valueOnOtherAxisScreenX <= dimensions.width-padding.right) ? (
                       <text
                        x={valueOnOtherAxisScreenX - (phInfo.axis === 'x' ? 5 : 0)}
                        y={valueOnOtherAxisScreenY + (phInfo.axis === 'y' ? 5 : 0)}
                      textAnchor={phInfo.axis === 'x' ? "end" : "middle"}
                      dominantBaseline={phInfo.axis === 'x' ? "middle" : "hanging"}
                      className="fill-red-500 dark:fill-red-400 text-xs"
                    >
                      {phInfo.axis === 'x' ? intersectPoint.yVal.toFixed(2) : intersectPoint.xVal.toFixed(2)}
                    </text>
                    ) : null}
                  </>
                );
              })()}
            </g>
          )}

          {/* Clicked Axis Indicator Lines and Text */}
          {clickedAxisInfo && clickedAxisInfo.intersectOnGraph && (
            <g className="clicked-axis-indicator">
              {(() => {
                const screenGraphIntersect = getScreenCoordinates(clickedAxisInfo.intersectOnGraph);
                // Ensure lines are drawn within plot area bounds
                 const lineStartX = Math.max(padding.left, Math.min(clickedAxisInfo.screenPos.x, dimensions.width - padding.right));
                 const lineStartY = Math.max(padding.top, Math.min(clickedAxisInfo.screenPos.y, dimensions.height - padding.bottom));
                 const lineEndX = Math.max(padding.left, Math.min(screenGraphIntersect.x, dimensions.width - padding.right));
                 const lineEndY = Math.max(padding.top, Math.min(screenGraphIntersect.y, dimensions.height - padding.bottom));

                return (
                  <>
                    <line
                      x1={lineStartX}
                      y1={lineStartY}
                      x2={lineEndX}
                      y2={lineEndY}
                      className="stroke-red-500 dark:stroke-red-400"
                      strokeWidth="1"
                    />
                    <text
                      x={screenGraphIntersect.x + (clickedAxisInfo.axis === 'x' ? 0 : 5)}
                      y={screenGraphIntersect.y - 5}
                      textAnchor={clickedAxisInfo.axis === 'x' ? "middle" : "start"}
                      className="fill-red-500 dark:fill-red-400 text-xs"
                    >
                      {clickedAxisInfo.otherAxisValue.toFixed(2)}
                    </text>
                  </>
                );
              })()}
            </g>
          )}
        </svg>
      )}
    </div>
  );
};

export default CoordinateSystem;

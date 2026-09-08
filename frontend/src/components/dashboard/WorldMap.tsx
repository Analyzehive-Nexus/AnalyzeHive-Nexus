"use client";

import { memo } from "react";
import { ComposableMap, Geographies, Geography, Graticule } from "react-simple-maps";
import { palette, intensityRamp } from "@/lib/theme";

// react-simple-maps ships no types for the geography objects it yields, so
// declare the subset this component actually reads.
interface GeoFeature {
  rsmKey: string;
  properties: { name: string };
}

// TopoJSON URL
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Heatmap logic: Generates a pseudo-random intensity (0.0 - 1.0) based on country name
const getRandomIntensity = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const normalized = (Math.abs(hash) % 100) / 100;
  // Biasing towards lower intensity so "hot" zones pop out more
  return normalized > 0.75 ? normalized : 0.1; 
};

// Choropleth bucket: intensity picks a step off the shared emerald ramp, so
// density reads as ink weight against the white canvas.
const getColor = (intensity: number) => {
  if (intensity < 0.2) return intensityRamp[0]; // inactive
  if (intensity < 0.4) return intensityRamp[1];
  if (intensity < 0.6) return intensityRamp[2];
  if (intensity < 0.8) return intensityRamp[3];
  return intensityRamp[4]; // hotspot
};

function WorldMap({ scale = 110 }: { scale?: number }) {
  return (
    // Container: white panel with a hairline border
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden rounded-2xl bg-surface border border-line">

      {/* Title / Overlay Info */}
      <div className="absolute top-6 left-6 z-10 pointer-events-none">
        <h3 className="text-sm font-medium text-fg">Sales Audit Heatmap</h3>
        <p className="text-xs text-muted">Global transaction density</p>
      </div>

      <div className="w-full h-full pt-10 px-4 pb-2">
        <ComposableMap
          projection="geoMercator" // Flat sheet map projection
          projectionConfig={{
            scale,
            center: [0, 20], // Adjusted center for a balanced world view
          }}
          style={{ width: "100%", height: "100%", transition: "all 300ms" }}
        >
          {/* Subtle graticule for orientation, kept below the country fills */}
          <Graticule stroke={palette.line} strokeWidth={0.5} />

          {/* Map Geometries (Countries) */}
          <Geographies geography={geoUrl}>
            {({ geographies }: { geographies: GeoFeature[] }) =>
              geographies.map((geo) => {
                // Calculate intensity for this specific country
                const intensity = getRandomIntensity(geo.rsmKey || geo.properties.name);
                
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    // Apply dynamic heatmap color
                    fill={getColor(intensity)}
                    // Hairline must be darker than the palest ramp step, or
                    // adjacent inactive countries merge into one shape.
                    stroke={palette.lineStrong}
                    strokeWidth={0.4}
                    style={{
                      default: { outline: "none" },
                      hover: {
                        fill: palette.accent,
                        outline: "none",
                        transition: "all 150ms",
                        cursor: "pointer",
                      },
                      pressed: { fill: palette.accentHover, outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>
    </div>
  );
}

// Export memoized
export default memo(WorldMap);


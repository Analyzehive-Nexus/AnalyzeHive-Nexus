"use client";

import { memo } from "react";
import { ComposableMap, Geographies, Geography, Graticule } from "react-simple-maps";

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

// Premium Heatmap Colors (Dark Slate to Neon Green)
const getColor = (intensity: number) => {
  if (intensity < 0.2) return "#1e293b"; // Base Dark (Slate 800) - Inactive
  if (intensity < 0.4) return "#14532d"; // Dark Green (Green 900)
  if (intensity < 0.6) return "#15803d"; // Medium Green (Green 700)
  if (intensity < 0.8) return "#22c55e"; // Bright Green (Green 500)
  return "#7cff4e"; // Neon Highlight for hotspots
};

function WorldMap({ scale = 110 }: { scale?: number }) {
  return (
    // Container: Dark background, glowing subtle border
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden rounded-2xl bg-[#0b0f14] border border-white/5">

      {/* Title / Overlay Info */}
      <div className="absolute top-6 left-6 z-10 pointer-events-none">
        <h3 className="text-sm font-medium text-[#e6eaf0]">Sales Audit Heatmap</h3>
        <p className="text-xs text-[#9aa4b2]">Global transaction density</p>
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
          {/* Subtle Grid Lines for a premium technical look */}
          <Graticule stroke="rgba(255,255,255,0.02)" strokeWidth={0.5} />

          {/* Map Geometries (Countries) */}
          <Geographies geography={geoUrl}>
            {({ geographies }: { geographies: any[] }) =>
              geographies.map((geo: any) => {
                // Calculate intensity for this specific country
                const intensity = getRandomIntensity(geo.rsmKey || geo.properties.name);
                
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    // Apply dynamic heatmap color
                    fill={getColor(intensity)}
                    // Dark borders to separate countries cleanly
                    stroke="#0b0f14" 
                    strokeWidth={0.5}
                    style={{
                      default: { outline: "none" },
                      hover: {
                        fill: "#7cff4e", // Turn neon green on hover
                        outline: "none",
                        transition: "all 150ms",
                        cursor: "pointer",
                        // Add a glow effect on hover for that "premium" feel
                        filter: "drop-shadow(0 0 6px rgba(124, 255, 78, 0.4))"
                      },
                      pressed: { fill: "#22c55e", outline: "none" },
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


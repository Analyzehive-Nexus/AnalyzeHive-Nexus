/**
 * Canvas-side mirror of the design tokens in `src/app/globals.css`.
 *
 * Charts (Recharts), the world map and the network graph paint through SVG
 * attributes and inline styles, which cannot read Tailwind utilities. Those
 * call sites import from here so there is still a single place to change a
 * colour - keep this file and the `@theme` block in globals.css in step.
 */
export const palette = {
  canvas: "#f6f8fa",
  surface: "#ffffff",
  elevated: "#f8fafc",
  sunken: "#f1f5f9",
  line: "#e6ebf1",
  lineStrong: "#cfd8e3",

  fg: "#0f172a",
  muted: "#475569",
  subtle: "#64748b",
  faint: "#94a3b8",

  accent: "#047857",
  accentHover: "#065f46",
  accentTint: "#ecfdf5",
  accentLine: "#a7f3d0",

  ok: "#047857",
  warn: "#b45309",
  danger: "#b91c1c",
  info: "#1d4ed8",
} as const;

/**
 * Sequential emerald ramp for the choropleth, light to dark. Intensity maps to
 * ink density rather than glow, so low-activity regions stay legible against
 * the white canvas instead of disappearing into it.
 */
export const intensityRamp = [
  "#eef2f6", // no / negligible activity - neutral, not green
  "#d1fae5",
  "#6ee7b7",
  "#10b981",
  "#047857", // hotspot
] as const;

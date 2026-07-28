import { Router } from "express";

export const commercialTruthRouter = Router();

const hierarchyData = [
  { id: "RP", name: "R. Patel", role: "Area Manager", teamSize: 8, initials: "RP", color: "bg-emerald-500", reported: 98, verified: 72, status: "Flagged", region: "North" },
  { id: "SK", name: "S. Kumar", role: "Regional Lead", teamSize: 24, initials: "SK", color: "bg-blue-500", reported: 95, verified: 91, status: "Verified", region: "West" },
  { id: "MS", name: "M. Singh", role: "Area Manager", teamSize: 6, initials: "MS", color: "bg-purple-500", reported: 92, verified: 58, status: "Flagged", region: "North" },
  { id: "AR", name: "A. Reddy", role: "Zone Manager", teamSize: 45, initials: "AR", color: "bg-indigo-500", reported: 88, verified: 85, status: "Verified", region: "South" },
  { id: "KJ", name: "K. Johnson", role: "Area Manager", teamSize: 12, initials: "KJ", color: "bg-orange-500", reported: 99, verified: 96, status: "Verified", region: "East" },
  { id: "LW", name: "L. Wei", role: "City Lead", teamSize: 5, initials: "LW", color: "bg-pink-500", reported: 85, verified: 60, status: "Flagged", region: "West" },
];

commercialTruthRouter.get("/hierarchy", (req, res) => {
  const region = String(req.query.region ?? "all");
  const filtered =
    region === "all" ? hierarchyData : hierarchyData.filter((h) => h.region === region);
  res.json({ hierarchy: filtered, regions: ["North", "South", "East", "West"] });
});

const auditLogs: Record<string, { timestamp: string; event: string }[]> = {
  RP: [
    { timestamp: "10 Jan · 09:12", event: "GPS check-in logged at Warehouse North (unverified)" },
    { timestamp: "10 Jan · 11:30", event: "Reported 4 client visits; 1 GPS-corroborated" },
    { timestamp: "10 Jan · 13:42", event: "Flagged: reported location does not match device GPS trail" },
  ],
  MS: [
    { timestamp: "09 Jan · 10:05", event: "Reported 6 client visits; 2 GPS-corroborated" },
    { timestamp: "09 Jan · 16:20", event: "Flagged: call duration mismatch with reported visit length" },
  ],
  LW: [
    { timestamp: "08 Jan · 14:00", event: "Reported 3 client visits; 1 GPS-corroborated" },
    { timestamp: "08 Jan · 17:45", event: "Flagged: duplicate visit report across two clients" },
  ],
};

commercialTruthRouter.get("/audit/:id/log", (req, res) => {
  const log = auditLogs[req.params.id] ?? [
    { timestamp: "—", event: "No anomalies detected. Reporting cadence aligns with field movement." },
  ];
  res.json({ id: req.params.id, log });
});

import { Router } from "express";

export const alertsRouter = Router();

interface Alert {
  id: number;
  level: "critical" | "warning";
  title: string;
  desc: string;
  time: string;
  detail: string;
}

const alerts: Alert[] = [
  {
    id: 1,
    level: "critical",
    title: "Amoxicillin batch at risk",
    desc: "92% probability of expiry breach",
    time: "10 Jan · 13:42",
    detail:
      "Batch P-001245 (Amoxicillin) is projected to breach expiry before it clears current warehouse stock. GPS-tagged transit logs show a 6-day dwell time at the North distribution hub, well above the 2-day target. Recommend immediate redistribution to a high-turnover region.",
  },
  {
    id: 2,
    level: "warning",
    title: "Cold chain deviation",
    desc: "Warehouse A temperature spike",
    time: "10 Jan · 13:28",
    detail:
      "Warehouse A sensor logged a temperature spike to 9.2°C at 13:11, exceeding the 8°C cold-chain threshold for 14 minutes before recovering. No product loss confirmed yet; flagged for QA review.",
  },
];

alertsRouter.get("/", (_req, res) => {
  res.json({ alerts });
});

alertsRouter.get("/:id", (req, res) => {
  const alert = alerts.find((a) => a.id === Number(req.params.id));
  if (!alert) {
    return res.status(404).json({ detail: "Alert not found" });
  }
  res.json(alert);
});

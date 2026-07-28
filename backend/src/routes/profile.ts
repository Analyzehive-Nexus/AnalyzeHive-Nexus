import { Router } from "express";

export const profileRouter = Router();

const activityLog = [
  { id: 1, action: "Authorized transfer at Warehouse North", time: "2 mins ago", type: "success" },
  { id: 2, action: "Updated security protocols for APAC region", time: "2 hours ago", type: "info" },
  { id: 3, action: "Login detected from new device (iPad Pro)", time: "Yesterday", type: "warning" },
  { id: 4, action: "Generated Q3 Forecast Report", time: "2 days ago", type: "success" },
  { id: 5, action: "Approved redistribution of 3,000 units", time: "3 days ago", type: "success" },
  { id: 6, action: "Reviewed flagged audit for R. Patel", time: "4 days ago", type: "warning" },
  { id: 7, action: "Exported Commercial Truth report", time: "5 days ago", type: "info" },
  { id: 8, action: "Updated notification preferences", time: "1 week ago", type: "info" },
];

profileRouter.get("/activity", (req, res) => {
  const limit = Math.max(1, Number(req.query.limit ?? 4));
  res.json({
    activity: activityLog.slice(0, limit),
    total: activityLog.length,
  });
});

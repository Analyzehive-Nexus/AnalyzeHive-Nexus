import { Router } from "express";

export const marketRadarRouter = Router();

const signals = [
  { id: 1, source: "PubMed", time: "2m ago", title: "Competitor X launched new diabetic study with promising Phase II results", sentiment: "positive", impact: "High" },
  { id: 2, source: "Twitter/X", time: "15m ago", title: "Rising discussions about Competitor Y pricing strategy in West region", sentiment: "neutral", impact: "Medium" },
  { id: 3, source: "News Alert", time: "42m ago", title: "Competitor Z receives FDA approval for new cardiovascular drug", sentiment: "critical", impact: "Critical" },
  { id: 4, source: "LinkedIn", time: "1h ago", title: "VP of Sales at Competitor A posts about expansion into APAC", sentiment: "positive", impact: "Low" },
  { id: 5, source: "MarketWatch", time: "2h ago", title: "Sector analysis predicts 15% growth in biologics for Q3", sentiment: "neutral", impact: "Medium" },
  { id: 6, source: "Regulatory", time: "4h ago", title: "New compliance standards issued for medical device packaging", sentiment: "critical", impact: "High" },
];

marketRadarRouter.get("/signals", (req, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const filtered = q
    ? signals.filter(
        (s) => s.title.toLowerCase().includes(q) || s.source.toLowerCase().includes(q)
      )
    : signals;
  res.json({ signals: filtered });
});

const nodeAnalyses: Record<string, { summary: string; recentActivity: string[]; recommendation: string }> = {
  A: {
    summary: "Competitor A is aggressively expanding into APAC, with 3 major signals detected in the past 24h.",
    recentActivity: [
      "VP of Sales publicly discussed APAC expansion plans",
      "Filed 2 new regional distribution licenses",
      "Increased ad spend by an estimated 18% week-over-week",
    ],
    recommendation: "Monitor West-region pricing closely; consider a defensive campaign in APAC within 30 days.",
  },
  B: {
    summary: "Competitor B activity is stable with no material threats this period.",
    recentActivity: ["Routine quarterly earnings call, no strategic shifts announced"],
    recommendation: "No immediate action required.",
  },
  C: {
    summary: "Market C shows early signs of demand softening.",
    recentActivity: ["Sector analysis predicts slower biologics growth for Q3"],
    recommendation: "Re-evaluate Q3 allocation forecasts for this market.",
  },
  D: {
    summary: "Supplier D flagged for regulatory correlation risk.",
    recentActivity: ["New compliance standards issued affecting packaging suppliers"],
    recommendation: "Request updated compliance documentation from Supplier D within 2 weeks.",
  },
};

marketRadarRouter.get("/nodes/:id/analysis", (req, res) => {
  const analysis = nodeAnalyses[req.params.id];
  if (!analysis) {
    return res.json({
      summary: "No significant signals detected for this entity in the past 24h.",
      recentActivity: [],
      recommendation: "Continue routine monitoring.",
    });
  }
  res.json(analysis);
});

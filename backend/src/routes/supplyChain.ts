import { Router } from "express";

export const supplyChainRouter = Router();

const watchlist = [
  { sku: "SKU-9988", name: "Insulin Glargine 100U/ml", risk: "120 days", value: "₹52,000", location: "North", status: "Critical" },
  { sku: "SKU-7721", name: "Atorvastatin 40mg", risk: "145 days", value: "₹28,000", location: "West", status: "Warning" },
  { sku: "SKU-5532", name: "Metformin XR 1000mg", risk: "156 days", value: "₹15,000", location: "East", status: "Good" },
  { sku: "SKU-3345", name: "Omeprazole 20mg", risk: "180 days", value: "₹22,000", location: "South", status: "Good" },
  { sku: "SKU-4471", name: "Losartan 50mg", risk: "98 days", value: "₹19,500", location: "North", status: "Critical" },
  { sku: "SKU-6620", name: "Azithromycin 500mg", risk: "132 days", value: "₹31,200", location: "West", status: "Warning" },
  { sku: "SKU-8890", name: "Pantoprazole 40mg", risk: "167 days", value: "₹12,800", location: "East", status: "Good" },
  { sku: "SKU-2234", name: "Amlodipine 5mg", risk: "175 days", value: "₹9,400", location: "South", status: "Good" },
];

supplyChainRouter.get("/watchlist", (_req, res) => {
  res.json({ watchlist });
});

supplyChainRouter.get("/plan", (_req, res) => {
  res.json({
    summary:
      "Redistribute surplus stock from Warehouse North to Warehouse West to avoid an estimated ₹2.6Cr in expiry losses over the next 45 days.",
    steps: [
      "Transfer 3,000 units of high-risk SKUs from Warehouse North to Warehouse West",
      "Prioritize SKU-9988 (Insulin Glargine) and SKU-4471 (Losartan) - both under 100 days to critical",
      "Schedule transfer window within 72 hours to stay ahead of demand ramp in West",
      "Re-run risk scoring after transfer completes to confirm exposure reduction",
    ],
  });
});

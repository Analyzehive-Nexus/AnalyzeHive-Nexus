import { Router } from "express";
import { query } from "../db/d1.js";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({ status: "ok", service: "express-backend", time: new Date().toISOString() });
});

healthRouter.get("/d1", async (_req, res) => {
  try {
    const cfApi = process.env.CLOUDFLARE_D1_API_BASE ?? "https://api.cloudflare.com/client/v4";
    const tables = await query("SELECT name FROM sqlite_master WHERE type='table' LIMIT 5");
    res.json({
      status: "ok",
      cfApi,
      hasAccountId: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID),
      hasDatabaseId: Boolean(process.env.CLOUDFLARE_D1_DATABASE_ID),
      hasApiToken: Boolean(process.env.CLOUDFLARE_API_TOKEN),
      hasGoogleClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
      hasGoogleSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      hasGoogleRedirect: Boolean(process.env.GOOGLE_REDIRECT_URI),
      tables,
    });
  } catch (cause) {
    res.status(500).json({
      status: "error",
      error: cause instanceof Error ? cause.message : String(cause),
      cfApi: process.env.CLOUDFLARE_D1_API_BASE ?? "https://api.cloudflare.com/client/v4",
      hasAccountId: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID),
      hasDatabaseId: Boolean(process.env.CLOUDFLARE_D1_DATABASE_ID),
      hasApiToken: Boolean(process.env.CLOUDFLARE_API_TOKEN),
      hasGoogleClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
      hasGoogleSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
      hasGoogleRedirect: Boolean(process.env.GOOGLE_REDIRECT_URI),
    });
  }
});

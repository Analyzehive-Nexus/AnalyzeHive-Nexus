import { Router } from "express";
import { first, query, run } from "../db/d1.js";
import { toIso } from "../db/rows.js";

export const currencyRouter = Router();

/**
 * Display-currency support.
 *
 * Amounts are stored once, in INR paise, everywhere in the schema. This route
 * hands the frontend the rate table and the caller's preference so conversion
 * and formatting happen at the edge. Storing an amount twice in two currencies
 * would guarantee they drift.
 */

interface CurrencyRow {
  code: string;
  symbol: string;
  name: string;
  minor_units: number;
  locale: string;
  rate_from_inr: number;
  as_of: string;
}

currencyRouter.get("/", async (req, res) => {
  try {
    const rows = await query<CurrencyRow>(
      `SELECT c.code, c.symbol, c.name, c.minor_units, c.locale,
              f.rate_from_inr, f.as_of
         FROM currencies c
         JOIN fx_rates f ON f.code = c.code
        ORDER BY (c.code <> 'INR'), c.code`
    );

    const pref = await first<{ preferred_currency: string | null }>(
      `SELECT preferred_currency FROM users WHERE id = ?`,
      [req.user?.id ?? ""]
    );

    res.json({
      // Canonical storage currency. The frontend multiplies by rateFromInr.
      base: "INR",
      selected: pref?.preferred_currency ?? "INR",
      currencies: rows.map((r) => ({
        code: r.code,
        symbol: r.symbol,
        name: r.name,
        minorUnits: r.minor_units,
        locale: r.locale,
        rateFromInr: r.rate_from_inr,
        asOf: toIso(r.as_of),
      })),
    });
  } catch (cause) {
    console.error("[currency] list failed:", cause);
    res.status(503).json({ detail: "Could not load currencies" });
  }
});

currencyRouter.put("/preference", async (req, res) => {
  const code = typeof req.body?.code === "string" ? req.body.code.toUpperCase() : "";
  try {
    // Validate against the table rather than a hardcoded list, so adding a
    // currency is a row and not a deploy.
    const known = await first<{ code: string }>(
      `SELECT code FROM currencies WHERE code = ?`,
      [code]
    );
    if (!known) return res.status(400).json({ detail: "Unknown currency" });

    await run(`UPDATE users SET preferred_currency = ? WHERE id = ?`, [code, req.user?.id ?? ""]);
    res.json({ selected: code });
  } catch (cause) {
    console.error("[currency] preference failed:", cause);
    res.status(503).json({ detail: "Could not save preference" });
  }
});

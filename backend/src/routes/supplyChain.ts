import { Router } from "express";
import { batchQuery, first, query, run } from "../db/d1.js";
import { toBool, toIso } from "../db/rows.js";
import { regionScope } from "../db/scope.js";

export const supplyChainRouter = Router();

interface BatchRow {
  batch_code: string | null;
  sku: string;
  name: string;
  quantity: number;
  value_minor: number;
  expiry_date: string;
  days_to_expiry: number;
  status: string;
  region_name: string | null;
}

/**
 * "120 days" and "Rs 52,000" are derived, not stored: days come from the
 * expiry date at query time (so they count down instead of freezing at
 * whatever was typed), and money is integer paise the UI formats. The
 * prototype stored both as strings, which is why neither could be summed or
 * sorted.
 */
supplyChainRouter.get("/watchlist", async (req, res) => {
  const scope = regionScope(req.user, "b.region_id");
  try {
    const rows = await query<BatchRow>(
      `SELECT b.batch_code, b.sku, s.name, b.quantity, b.value_minor,
              b.expiry_date, b.status, r.name AS region_name,
              CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER)
                AS days_to_expiry
         FROM inventory_batches b
         JOIN skus s ON s.sku = b.sku
         LEFT JOIN regions r ON r.id = b.region_id
        WHERE 1 = 1 ${scope.clause}
        ORDER BY days_to_expiry`,
      scope.params
    );

    res.json({
      watchlist: rows.map((row) => ({
        sku: row.sku,
        batchCode: row.batch_code,
        name: row.name,
        quantity: row.quantity,
        daysToExpiry: row.days_to_expiry,
        expiryDate: row.expiry_date,
        valueMinor: row.value_minor,
        location: row.region_name ?? "Unassigned",
        status: row.status,
      })),
    });
  } catch (cause) {
    console.error("[supply-chain] watchlist failed:", cause);
    res.status(503).json({ detail: "Could not load watchlist" });
  }
});

interface PlanRow {
  id: number;
  summary: string;
  status: string;
  created_at: string;
  instruction: string | null;
}

const NO_PLAN = {
  summary: "No redistribution plan has been generated yet.",
  steps: [] as string[],
  status: null as string | null,
  createdAt: null as string | null,
};

// Newest plan that is still live. An executed or cancelled plan stays in the
// table as history but is not what the page should be proposing.
supplyChainRouter.get("/plan", async (_req, res) => {
  try {
    const rows = await query<PlanRow>(
      `SELECT p.id, p.summary, p.status, p.created_at, st.instruction
         FROM redistribution_plans p
         LEFT JOIN redistribution_steps st ON st.plan_id = p.id
        WHERE p.id = (SELECT id FROM redistribution_plans
                       WHERE status IN ('draft', 'approved')
                       ORDER BY created_at DESC, id DESC
                       LIMIT 1)
        ORDER BY st.ordinal`
    );

    if (rows.length === 0) {
      return res.json(NO_PLAN);
    }

    res.json({
      summary: rows[0].summary,
      status: rows[0].status,
      createdAt: toIso(rows[0].created_at),
      steps: rows.map((r) => r.instruction).filter((s): s is string => s !== null),
    });
  } catch (cause) {
    console.error("[supply-chain] plan failed:", cause);
    res.status(503).json({ detail: "Could not load plan" });
  }
});

// ===========================================================================
// Freight, transit thermodynamics and ERP write-back.
//
// The simulator previously proposed a transfer with no notion of what moving
// stock costs, whether a refrigerated lane even exists, or what the heat
// exposure would do to the product. All three are load-bearing before anyone
// can approve a move.
// ===========================================================================


const GAS_CONSTANT = 8.314; // J/(mol*K)

/**
 * Arrhenius: k = A * exp(-Ea / (R * T)).
 *
 * We never know A, but we do not need it - taking the ratio of rate constants
 * at two temperatures cancels it out, so shelf life at T scales by
 * exp(Ea/R * (1/T - 1/Tref)). Temperatures must be absolute (Kelvin); doing
 * this in Celsius is the classic way to get a nonsense answer.
 */
function shelfLifeDaysAt(
  tempC: number,
  activationEnergyKj: number,
  referenceTempC: number,
  referenceShelfDays: number
): number {
  const Ea = activationEnergyKj * 1000;
  const T = tempC + 273.15;
  const Tref = referenceTempC + 273.15;
  const factor = Math.exp((Ea / GAS_CONSTANT) * (1 / T - 1 / Tref));
  return referenceShelfDays * factor;
}

interface LaneRow {
  id: number; mode: string; transit_hours: number; cost_per_unit_minor: number;
  reefer_available: number; ambient_max_c: number | null;
  origin_name: string; destination_name: string;
}

supplyChainRouter.get("/freight", async (req, res) => {
  const origin = typeof req.query.origin === "string" ? req.query.origin : null;
  const destination = typeof req.query.destination === "string" ? req.query.destination : null;
  try {
    const rows = await query<LaneRow>(
      `SELECT f.id, f.mode, f.transit_hours, f.cost_per_unit_minor,
              f.reefer_available, f.ambient_max_c,
              o.name AS origin_name, d.name AS destination_name
         FROM freight_lanes f
         JOIN warehouses o ON o.id = f.origin_id
         JOIN warehouses d ON d.id = f.destination_id
        WHERE (? IS NULL OR f.origin_id = ?)
          AND (? IS NULL OR f.destination_id = ?)
        ORDER BY f.cost_per_unit_minor`,
      [origin, origin, destination, destination]
    );
    res.json({
      lanes: rows.map((r) => ({
        id: r.id,
        mode: r.mode,
        origin: r.origin_name,
        destination: r.destination_name,
        transitHours: r.transit_hours,
        costPerUnitMinor: r.cost_per_unit_minor,
        reeferAvailable: toBool(r.reefer_available),
        ambientMaxC: r.ambient_max_c,
      })),
    });
  } catch (cause) {
    console.error("[supply-chain] freight failed:", cause);
    res.status(503).json({ detail: "Could not load freight lanes" });
  }
});

interface ArrRow {
  sku: string; activation_energy_kj: number; reference_temp_c: number;
  reference_shelf_days: number; potency_floor_pct: number; name: string;
}

/** Degradation curve for one SKU across a temperature sweep. */
supplyChainRouter.get("/arrhenius/:sku", async (req, res) => {
  try {
    const row = await first<ArrRow>(
      `SELECT a.sku, a.activation_energy_kj, a.reference_temp_c,
              a.reference_shelf_days, a.potency_floor_pct, s.name
         FROM arrhenius_profiles a
         JOIN skus s ON s.sku = a.sku
        WHERE a.sku = ?`,
      [req.params.sku]
    );
    if (!row) return res.status(404).json({ detail: "No stability profile for this SKU" });

    // 2C..40C in 2C steps - the range a road lane realistically sees.
    const curve: { tempC: number; shelfLifeDays: number; relativeRate: number }[] = [];
    for (let t = 2; t <= 40; t += 2) {
      const days = shelfLifeDaysAt(
        t, row.activation_energy_kj, row.reference_temp_c, row.reference_shelf_days
      );
      curve.push({
        tempC: t,
        shelfLifeDays: Math.round(days),
        relativeRate: Number((row.reference_shelf_days / days).toFixed(3)),
      });
    }

    res.json({
      sku: row.sku,
      name: row.name,
      activationEnergyKj: row.activation_energy_kj,
      referenceTempC: row.reference_temp_c,
      referenceShelfDays: row.reference_shelf_days,
      potencyFloorPct: row.potency_floor_pct,
      curve,
    });
  } catch (cause) {
    console.error("[supply-chain] arrhenius failed:", cause);
    res.status(503).json({ detail: "Could not load stability profile" });
  }
});

/**
 * Whole-transfer economics: salvage value minus freight, the thermal buffer
 * on the chosen lane, and whether the move would strand the source below its
 * own safety stock.
 */
supplyChainRouter.get("/simulate", async (req, res) => {
  const sku = typeof req.query.sku === "string" ? req.query.sku : "";
  const origin = typeof req.query.origin === "string" ? req.query.origin : "";
  const destination = typeof req.query.destination === "string" ? req.query.destination : "";
  const units = Math.max(0, Number(req.query.units) || 0);

  try {
    const [batches, lanes, profiles] = await batchQuery<
      [{ quantity: number; value_minor: number; safety_stock_units: number }[],
       LaneRow[],
       ArrRow[]]
    >([
      {
        sql: `SELECT COALESCE(SUM(quantity), 0) AS quantity,
                     COALESCE(SUM(value_minor), 0) AS value_minor,
                     COALESCE(MAX(safety_stock_units), 0) AS safety_stock_units
                FROM inventory_batches
               WHERE sku = ? AND warehouse_id = ?`,
        params: [sku, origin],
      },
      {
        sql: `SELECT f.id, f.mode, f.transit_hours, f.cost_per_unit_minor,
                     f.reefer_available, f.ambient_max_c,
                     o.name AS origin_name, d.name AS destination_name
                FROM freight_lanes f
                JOIN warehouses o ON o.id = f.origin_id
                JOIN warehouses d ON d.id = f.destination_id
               WHERE f.origin_id = ? AND f.destination_id = ?
               ORDER BY f.cost_per_unit_minor`,
        params: [origin, destination],
      },
      {
        sql: `SELECT a.sku, a.activation_energy_kj, a.reference_temp_c,
                     a.reference_shelf_days, a.potency_floor_pct, s.name
                FROM arrhenius_profiles a JOIN skus s ON s.sku = a.sku
               WHERE a.sku = ?`,
        params: [sku],
      },
    ]);

    const stock = batches[0];
    const onHand = stock?.quantity ?? 0;
    const safety = stock?.safety_stock_units ?? 0;
    // Value per unit at the source, used to price the salvage.
    const unitValueMinor = onHand > 0 ? Math.floor((stock?.value_minor ?? 0) / onHand) : 0;

    const options = lanes.map((lane) => {
      const freightMinor = lane.cost_per_unit_minor * units;
      const salvageMinor = unitValueMinor * units;
      const netMinor = salvageMinor - freightMinor;
      const profile = profiles[0];

      // Hours before the payload would breach its potency floor at the lane's
      // worst-case ambient, if it travelled unrefrigerated.
      let thermalRunwayHours: number | null = null;
      if (profile && lane.ambient_max_c !== null) {
        const daysAtAmbient = shelfLifeDaysAt(
          lane.ambient_max_c, profile.activation_energy_kj,
          profile.reference_temp_c, profile.reference_shelf_days
        );
        thermalRunwayHours = Number((daysAtAmbient * 24).toFixed(1));
      }

      return {
        laneId: lane.id,
        mode: lane.mode,
        transitHours: lane.transit_hours,
        reeferAvailable: toBool(lane.reefer_available),
        ambientMaxC: lane.ambient_max_c,
        freightCostMinor: freightMinor,
        salvageValueMinor: salvageMinor,
        netSalvageMinor: netMinor,
        // Revenue recovered minus freight, as a share of what was salvaged.
        netSalvageYieldPct: salvageMinor === 0
          ? null
          : Number(((netMinor / salvageMinor) * 100).toFixed(1)),
        thermalRunwayHours,
        // Only meaningful without a reefer; with one the band is held.
        thermalRunwayBreached: !toBool(lane.reefer_available) &&
          thermalRunwayHours !== null && thermalRunwayHours < lane.transit_hours,
      };
    });

    const remaining = onHand - units;
    res.json({
      sku,
      units,
      unitValueMinor,
      source: {
        onHand,
        safetyStockUnits: safety,
        remainingAfterTransfer: remaining,
        // The check the old simulator never made: solving an expiry problem
        // at the destination by creating a stockout at the source.
        inducesStockout: remaining < safety,
        shortfallUnits: remaining < safety ? safety - remaining : 0,
      },
      options,
    });
  } catch (cause) {
    console.error("[supply-chain] simulate failed:", cause);
    res.status(503).json({ detail: "Could not run simulation" });
  }
});

/**
 * Raises the SAP Stock Transport Order that the physical move happens against.
 * Without this the app has recorded an intention and nothing else. The write
 * is also mirrored into the Part 11 audit trail.
 */
supplyChainRouter.post("/sto", async (req, res) => {
  const { origin, destination, sku, units } = req.body ?? {};
  if (typeof origin !== "string" || typeof destination !== "string" ||
      typeof sku !== "string" || !Number.isFinite(Number(units)) || Number(units) <= 0) {
    return res.status(400).json({ detail: "origin, destination, sku and a positive units are required" });
  }

  try {
    const meta = await run(
      `INSERT INTO sto_writebacks
         (origin_id, destination_id, sku, units, status, requested_by)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [origin, destination, sku, Math.floor(Number(units)), req.user?.id ?? null]
    );
    const id = meta.last_row_id;

    await run(
      `INSERT INTO audit_trail
         (user_id, action, entity_type, entity_id, new_value, reason)
       VALUES (?, 'create', 'sto_writeback', ?, 'pending', 'Raised from redistribution simulator')`,
      [req.user?.id ?? null, String(id)]
    );

    // A real integration posts to SAP here and flips to 'acknowledged' on the
    // IDoc response. Until that exists the row stays 'pending', which is an
    // honest state rather than a fabricated document number.
    res.status(201).json({
      id,
      status: "pending",
      sapDocNo: null,
      detail: "Stock Transport Order queued for SAP. It stays pending until the ERP acknowledges.",
    });
  } catch (cause) {
    console.error("[supply-chain] sto failed:", cause);
    res.status(503).json({ detail: "Could not raise the Stock Transport Order" });
  }
});

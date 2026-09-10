/**
 * Live health probe against the real SAP Business Accelerator Hub sandbox
 * (sandbox.api.sap.com) - not a company's actual SAP tenant, but a real,
 * internet-hosted S/4HANA-shaped OData service Cloudflare has to actually
 * round-trip to. This is what backs the "SAP S/4HANA" row in erp_sync_status
 * on the command-center dashboard: a genuine network call, timed for real,
 * rather than a seeded random latency figure.
 *
 * Requires a free API key from https://api.sap.com (sign up -> search
 * "Business Partner (A2X)" -> Show API Key). Set SAP_SANDBOX_API_KEY. When
 * unset, callers should skip the probe and let the seeded synthetic rows
 * stand - this never throws for a missing key.
 */

const ENDPOINT =
  "https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner?$top=1";

export interface SapPingResult {
  latencyMs: number;
  status: "healthy" | "lagging" | "failed";
  recordsSynced: number;
}

/** True when SAP_SANDBOX_API_KEY is set - lets callers skip the probe cleanly. */
export function isConfigured(): boolean {
  return Boolean(process.env.SAP_SANDBOX_API_KEY);
}

/**
 * Calls the sandbox and measures wall-clock latency. Never throws: a network
 * failure or a slow response both come back as a normal result so the
 * dashboard degrades to "failed" instead of a 503.
 */
export async function pingSapSandbox(): Promise<SapPingResult> {
  const apiKey = process.env.SAP_SANDBOX_API_KEY;
  if (!apiKey) {
    return { latencyMs: 0, status: "failed", recordsSynced: 0 };
  }

  const started = performance.now();
  try {
    const response = await fetch(ENDPOINT, {
      headers: { APIKey: apiKey, Accept: "application/json" },
      // The sandbox is a shared demo instance and occasionally stalls - don't
      // let a slow probe hold up the whole /kpis response.
      signal: AbortSignal.timeout(4_000),
    });
    const latencyMs = Math.round(performance.now() - started);

    if (!response.ok) {
      return { latencyMs, status: "failed", recordsSynced: 0 };
    }

    const body = (await response.json()) as {
      d?: { results?: unknown[] };
      value?: unknown[];
    };
    const recordsSynced = (body.d?.results ?? body.value ?? []).length;

    return {
      latencyMs,
      status: latencyMs > 2_000 ? "lagging" : "healthy",
      recordsSynced,
    };
  } catch {
    return {
      latencyMs: Math.round(performance.now() - started),
      status: "failed",
      recordsSynced: 0,
    };
  }
}

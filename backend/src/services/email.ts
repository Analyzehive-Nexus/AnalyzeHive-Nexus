/**
 * Transactional email via Resend's HTTP API.
 *
 * Optional, same convention as sapSandbox.ts: unset RESEND_API_KEY and this
 * is a clean no-op - the caller keeps its existing behaviour (log server-side,
 * echo the link outside production). Set it and the verification link an
 * invited/active user requests actually reaches their inbox.
 *
 * Resend, not SMTP: no mail server to run, a free tier that covers a
 * prototype's volume, and a single POST - matching this codebase's existing
 * preference for a real hosted API over a self-run service (see the SAP
 * sandbox probe and the D1 REST transport).
 */

const ENDPOINT = "https://api.resend.com/emails";

/** True when RESEND_API_KEY is set - lets callers skip sending cleanly. */
export function isConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function fromAddress(): string {
  // Resend requires a domain verified in that account; onboarding@resend.dev
  // works unverified but only delivers to the account owner's own address,
  // which is fine for a prototype and documented in .env.example.
  return process.env.EMAIL_FROM ?? "AnalyzeHive Nexus <onboarding@resend.dev>";
}

/**
 * Sends the verification/reset link. Never throws: a provider outage or bad
 * key must not fail the request that triggered it - the caller already has a
 * server-logged link as a fallback.
 */
export async function sendVerificationEmail(to: string, link: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to,
        subject: "Sign in to AnalyzeHive Nexus",
        html: `
          <p>Use the link below to verify your email and set a password for AnalyzeHive Nexus.</p>
          <p><a href="${link}">${link}</a></p>
          <p>This link expires in 30 minutes. If you did not request it, you can ignore this email.</p>
        `,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      console.error("[email] Resend responded", response.status, await response.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (cause) {
    console.error("[email] send failed:", cause);
    return false;
  }
}

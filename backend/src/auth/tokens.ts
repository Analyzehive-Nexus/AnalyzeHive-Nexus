/**
 * Session token generation and hashing.
 *
 * Deliberately WebCrypto + Uint8Array only - no `Buffer`, no `node:crypto`.
 * Both exist in Node 20+ and the Cloudflare Workers runtime, so this file
 * moves to Workers unchanged. The previous implementation used Buffer and
 * would not have.
 *
 * The client holds the raw token; the database stores only its SHA-256 hash,
 * so a leaked `sessions` table cannot be replayed as live sessions.
 */

const SESSION_BYTES = 32;
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** A fresh, unguessable session token. 32 bytes of CSPRNG output. */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(SESSION_BYTES);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/** The value stored in sessions.id. Never store the raw token. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return base64UrlEncode(new Uint8Array(digest));
}

/** Random id for rows that need one (users, oauth state). */
export function randomId(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64UrlEncode(buf);
}

/** SQLite-friendly UTC timestamp: 'YYYY-MM-DD HH:MM:SS', matching datetime('now'). */
export function sqlTimestamp(date = new Date()): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

/**
 * Password hashing via WebCrypto PBKDF2.
 *
 * Deliberately WebCrypto + Uint8Array only, no `bcrypt`/`node:crypto` - the
 * same constraint as tokens.ts, for the same reason: this file has to move
 * to the Cloudflare Workers runtime unchanged.
 */
import { base64UrlDecode, base64UrlEncode } from "./tokens.js";

const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_LENGTH_BITS = 256;

export const MIN_PASSWORD_LENGTH = 8;

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    // `salt`'s declared type is the broader Uint8Array<ArrayBufferLike> (it
    // may come from base64UrlDecode), but every caller here hands it a real
    // ArrayBuffer-backed array - never a SharedArrayBuffer one.
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    KEY_LENGTH_BITS
  );
  return new Uint8Array(bits);
}

/** Constant-time comparison - a length or byte mismatch must not short-circuit early. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Stored as "iterations:saltB64url:hashB64url" so the cost factor can change later without breaking old rows. */
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  const hash = await deriveBits(password, salt, ITERATIONS);
  return `${ITERATIONS}:${base64UrlEncode(salt)}:${base64UrlEncode(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 3) return false;
  const [iterationsRaw, saltB64, hashB64] = parts;
  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;

  const salt = base64UrlDecode(saltB64);
  const expected = base64UrlDecode(hashB64);
  const actual = await deriveBits(password, salt, iterations);
  return timingSafeEqual(actual, expected);
}

/**
 * Google OAuth 2.0 authorization-code flow.
 *
 * Sign-in is invite-only: completing this flow proves who the caller is, it
 * does NOT grant access. The allowlist check against the `users` table happens
 * in routes/auth.ts after this module has established identity.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
  hostedDomain?: string;
}

export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new GoogleAuthError(
      "Google OAuth is not configured. Set GOOGLE_CLIENT_ID, " +
        "GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI (see .env.example)."
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI
  );
}

/** Where to send the browser to start sign-in. */
export function buildAuthUrl(state: string): string {
  const { clientId, redirectUri } = googleConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    // We never call Google APIs on the user's behalf, so no refresh token is
    // needed and no consent screen should be forced on repeat sign-ins.
    access_type: "online",
    prompt: "select_account",
  });

  // Optional defence in depth for a Workspace-only deployment. The users table
  // is the real allowlist; this just stops the round trip earlier.
  const hd = process.env.GOOGLE_HOSTED_DOMAIN;
  if (hd) params.set("hd", hd);

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface IdTokenClaims {
  iss?: string;
  aud?: string;
  exp?: number;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
  hd?: string;
}

function decodeJwtPayload(jwt: string): IdTokenClaims {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new GoogleAuthError("Malformed ID token");
  const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const json = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  // atob yields latin1; re-decode as UTF-8 so non-ASCII names survive.
  const bytes = Uint8Array.from(json, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as IdTokenClaims;
}

/**
 * Exchanges the authorization code for an ID token and returns the identity.
 *
 * The ID token's signature is not re-verified here, and that is correct: it
 * arrives directly from Google's token endpoint over TLS in response to a
 * request authenticated with our client secret. Google documents this case as
 * not requiring local signature validation. The claims below still are.
 */
export async function exchangeCodeForIdentity(code: string): Promise<GoogleIdentity> {
  const { clientId, clientSecret, redirectUri } = googleConfig();

  let response: Response;
  try {
    response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (cause) {
    throw new GoogleAuthError(
      `Could not reach Google: ${cause instanceof Error ? cause.message : String(cause)}`
    );
  }

  const payload = (await response.json().catch(() => ({}))) as TokenResponse;

  if (!response.ok || payload.error || !payload.id_token) {
    throw new GoogleAuthError(
      payload.error_description || payload.error || `Token exchange failed (HTTP ${response.status})`
    );
  }

  const claims = decodeJwtPayload(payload.id_token);

  if (!claims.iss || !GOOGLE_ISSUERS.includes(claims.iss)) {
    throw new GoogleAuthError("ID token has an unexpected issuer");
  }
  if (claims.aud !== clientId) {
    throw new GoogleAuthError("ID token was not issued for this client");
  }
  if (!claims.exp || claims.exp * 1000 <= Date.now()) {
    throw new GoogleAuthError("ID token has expired");
  }
  if (!claims.sub || !claims.email) {
    throw new GoogleAuthError("ID token is missing sub or email");
  }
  // An unverified address could be attacker-controlled, which would let them
  // claim an invite issued to someone else's address.
  const verified = claims.email_verified === true || claims.email_verified === "true";
  if (!verified) {
    throw new GoogleAuthError("Google account email is not verified");
  }

  const hd = process.env.GOOGLE_HOSTED_DOMAIN;
  if (hd && claims.hd !== hd) {
    throw new GoogleAuthError("Google account is outside the permitted domain");
  }

  return {
    sub: claims.sub,
    email: claims.email,
    emailVerified: verified,
    name: claims.name?.trim() || claims.email.split("@")[0],
    picture: claims.picture,
    hostedDomain: claims.hd,
  };
}

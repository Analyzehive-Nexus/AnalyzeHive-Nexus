/**
 * Whitelists a post-login redirect target.
 *
 * `callbackUrl` arrives from the query string, so an attacker can hand a user
 * a link like `/login?callbackUrl=https://evil.com` and have the app walk them
 * off-site the moment they authenticate. Only same-origin, path-absolute
 * targets are allowed through; anything else falls back to the dashboard.
 */
export function safeRedirect(target: string | null | undefined, fallback = "/"): string {
  if (!target) return fallback;

  // Must be path-absolute. Rejects "https://evil.com", "//evil.com"
  // (protocol-relative), and backslash variants that some browsers normalise
  // to forward slashes.
  if (!target.startsWith("/")) return fallback;
  if (target.startsWith("//") || target.startsWith("/\\")) return fallback;

  // Defence in depth: resolve against a throwaway origin and confirm nothing
  // (an encoded scheme, a stray control character) escaped it.
  try {
    const resolved = new URL(target, "http://localhost");
    if (resolved.origin !== "http://localhost") return fallback;
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return fallback;
  }
}

import { Router } from "express";

export const authRouter = Router();

interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

// Prototype-only "token": the user record base64url-encoded, no signature.
// It is deliberately stateless because each serverless invocation can land on
// a fresh instance, so an in-process session Map would drop sessions between
// requests. Replace the whole encode/decode pair with real signed JWT
// verification against a user store when auth becomes real - this proves
// nothing about the caller's identity.
const TOKEN_PREFIX = "mock.";

function encodeToken(user: SessionUser): string {
  return TOKEN_PREFIX + Buffer.from(JSON.stringify(user)).toString("base64url");
}

function decodeToken(token: string | null): SessionUser | null {
  if (!token || !token.startsWith(TOKEN_PREFIX)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(token.slice(TOKEN_PREFIX.length), "base64url").toString("utf8")
    ) as Partial<SessionUser>;

    if (!payload?.id || !payload?.email) return null;

    return {
      id: payload.id,
      email: payload.email,
      name: payload.name ?? "Test Agent",
      role: payload.role ?? "admin",
    };
  } catch {
    return null;
  }
}

function userFromRequest(authHeader: string | undefined): SessionUser | null {
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  return decodeToken(token);
}

// Mirrors the LoginResponse/ApiUser shape the frontend already expects
// (see frontend/src/lib/api.ts) so it's a drop-in replacement for the
// mocked client-side login once the frontend is pointed at this service.
authRouter.post("/login", (req, res) => {
  const { email } = req.body ?? {};

  if (!email) {
    return res.status(400).json({ detail: "email is required" });
  }

  const user: SessionUser = {
    id: "1",
    email: String(email),
    name: "Test Agent",
    role: "admin",
  };

  res.json({
    access_token: encodeToken(user),
    token_type: "bearer",
    user,
  });
});

authRouter.get("/me", (req, res) => {
  const user = userFromRequest(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ detail: "Invalid or missing token" });
  }

  res.json(user);
});

authRouter.post("/change-password", (req, res) => {
  const user = userFromRequest(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ detail: "Invalid or missing token" });
  }

  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ detail: "currentPassword and newPassword are required" });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ detail: "newPassword must be at least 8 characters" });
  }

  // Prototype only: no real credential store to update against yet.
  res.json({ success: true });
});

authRouter.post("/forgot-password", (req, res) => {
  const { email } = req.body ?? {};
  if (!email) {
    return res.status(400).json({ detail: "email is required" });
  }

  // Prototype only: no real email delivery yet.
  res.json({ sent: true, email });
});

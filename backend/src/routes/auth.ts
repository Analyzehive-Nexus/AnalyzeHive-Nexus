import { Router } from "express";

export const authRouter = Router();

const MOCK_TOKEN = "mock-jwt-token-12345";

// Prototype-only in-memory session store, keyed by token. Real auth will
// replace this with actual JWT verification / a real session/user store.
const sessions = new Map<
  string,
  { id: string; email: string; name: string; role: string }
>();

// Mirrors the LoginResponse/ApiUser shape the frontend already expects
// (see frontend/src/lib/api.ts) so it's a drop-in replacement for the
// mocked client-side login once the frontend is pointed at this service.
authRouter.post("/login", (req, res) => {
  const { email } = req.body ?? {};

  if (!email) {
    return res.status(400).json({ detail: "email is required" });
  }

  const user = { id: "1", email, name: "Test Agent", role: "admin" };
  sessions.set(MOCK_TOKEN, user);

  res.json({
    access_token: MOCK_TOKEN,
    token_type: "bearer",
    user,
  });
});

authRouter.get("/me", (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  const user = token ? sessions.get(token) : undefined;
  if (!user) {
    return res.status(401).json({ detail: "Invalid or missing token" });
  }

  res.json(user);
});

authRouter.post("/change-password", (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token || !sessions.get(token)) {
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

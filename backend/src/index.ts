import "dotenv/config";
import app from "./app.js";
import { run } from "./db/d1.js";

// Ensure Prakash Metla's email is seeded in D1
run(
  `INSERT OR IGNORE INTO users (id, email, name, role, status) VALUES (?, ?, ?, ?, ?)`,
  ["admin-prakash", "prakashmetla2020@gmail.com", "Prakash Metla", "admin", "invited"]
)
  .then(() => {
    console.log("[bootstrap] Ensured prakashmetla2020@gmail.com in D1 users table.");
  })
  .catch((err) => {
    console.warn("[bootstrap] Could not seed user into D1:", err);
  });

// Long-running entrypoint for local dev and any always-on host. Vercel does
// not use this file - it imports the app directly from api/index.ts.
const PORT = Number(process.env.PORT) || 8000;

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});


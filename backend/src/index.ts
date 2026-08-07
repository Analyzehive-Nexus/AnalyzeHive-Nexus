import "dotenv/config";
import app from "./app.js";

// Long-running entrypoint for local dev and any always-on host. Vercel does
// not use this file - it imports the app directly from api/index.ts.
const PORT = Number(process.env.PORT) || 8000;

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});

// Vercel serverless entrypoint. An Express app is already a
// (req, res) handler, so it can be exported directly as the function.
// vercel.json rewrites every path here, and Express routes off the
// original req.url.
import app from "../src/app.js";

export default app;

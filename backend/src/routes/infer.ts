import { Router } from "express";

export const inferRouter = Router();

const PYTHON_SERVICE_URL =
  process.env.PYTHON_SERVICE_URL || "http://localhost:8001";

// Thin proxy to the FastAPI inference service. Express never touches the
// GPU directly - it just forwards requests and relays the response.
inferRouter.post("/", async (req, res) => {
  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body ?? {}),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch {
    res.status(502).json({ detail: "Inference service unavailable" });
  }
});

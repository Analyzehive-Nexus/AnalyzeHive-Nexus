import "dotenv/config";
import { query } from "../src/db/d1.js";

async function check() {
  try {
    const res = await query("SELECT name FROM sqlite_master WHERE type='table'");
    console.log("D1 TABLES:", res);
  } catch (err) {
    console.error("D1 QUERY ERROR:", err);
  }
}

check();

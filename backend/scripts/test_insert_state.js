import "dotenv/config";
import { batch, run } from "../src/db/d1.js";
import { randomId, sqlTimestamp } from "../src/auth/tokens.js";

async function testState() {
  try {
    const state = randomId(24);
    const res = await batch([
      {
        sql: `INSERT INTO oauth_states (state, redirect_to, expires_at) VALUES (?, ?, ?)`,
        params: [state, "/", sqlTimestamp(new Date(Date.now() + 600000))],
      },
      { sql: `DELETE FROM oauth_states WHERE expires_at < ?`, params: [sqlTimestamp()] },
    ]);
    console.log("SUCCESS INSERTING STATE:", res);
  } catch (err) {
    console.error("FAIL INSERTING STATE:", err);
  }
}

testState();

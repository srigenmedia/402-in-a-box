import { describe, expect, it } from "vitest";
import { createStarterApp } from "../src/index.js";

describe("ts-worker-402 clean-room starter (UAT-10)", () => {
  it("completes 402 -> topup -> 200 + PAYMENT-RESPONSE -> replay (0 debit) -> 500 rollback", async () => {
    const { app, meter } = createStarterApp();

    const r402 = await app.request("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method: "tools/call", params: { name: "math.compound_interest", arguments: {} } }),
    });
    expect(r402.status).toBe(402);

    meter.mint("demo_tok_starter", "k_starter", 10);

    const r200 = await app.request("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer demo_tok_starter", "idempotency-key": "st_1" },
      body: JSON.stringify({ method: "tools/call", params: { name: "math.compound_interest", arguments: { principal: 1000, rate: 0.1, years: 2 } } }),
    });
    expect(r200.status).toBe(200);
    expect(r200.headers.get("payment-response")).toBeTruthy();
    expect((await r200.json()).total).toBe(1210);
    expect(meter.getBalance("k_starter")).toBe(8);

    const rReplay = await app.request("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer demo_tok_starter", "idempotency-key": "st_1" },
      body: JSON.stringify({ method: "tools/call", params: { name: "math.compound_interest", arguments: {} } }),
    });
    expect((await rReplay.json()).replayed).toBe(true);
    expect(meter.getBalance("k_starter")).toBe(8);

    const r500 = await app.request("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer demo_tok_starter", "idempotency-key": "st_err" },
      body: JSON.stringify({ method: "tools/call", params: { name: "math.compound_interest", arguments: { forceError: true } } }),
    });
    expect(r500.status).toBe(500);
    expect(meter.getBalance("k_starter")).toBe(8);
  });
});

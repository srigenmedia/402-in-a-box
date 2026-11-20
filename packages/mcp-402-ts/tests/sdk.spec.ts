import { describe, expect, it } from "vitest";
import { createMemoryMeterBackend, withMcp402Meter } from "../src/index.js";

describe("@srigenmedia/mcp-402 TS SDK", () => {
  it("1. returns HTTP 402 when unauthenticated and x402 defaults to disabled", async () => {
    const meter = createMemoryMeterBackend();
    const mw = withMcp402Meter({ meter });
    const res = await mw.handleRequest(new Request("http://localhost/mcp", { method: "POST" }), "demo.tool", 2, async () =>
      Response.json({ ok: true }),
    );
    expect(res.status).toBe(402);
    expect(res.headers.get("www-authenticate")).toContain("Payment");
    const pr = JSON.parse(atob(res.headers.get("payment-required") || ""));
    expect(pr.exactX_402_Enabled).toBe(false);
    const body = await res.json();
    expect(body.x402_facilitator.enabled).toBe(false);
  });

  it("2. meters 2PC debit, emits PAYMENT-RESPONSE, replays Idempotency-Key at 0 extra debit, and rolls back on >= 400", async () => {
    const meter = createMemoryMeterBackend({ demo_tok_1: { keyId: "k_1", units: 10 } });
    const mw = withMcp402Meter({ meter });

    const r1 = await mw.handleRequest(
      new Request("http://localhost/mcp", { method: "POST", headers: { authorization: "Bearer demo_tok_1", "idempotency-key": "id_1" } }),
      "math.calc",
      3,
      async () => Response.json({ answer: 42 }),
    );
    expect(r1.status).toBe(200);
    expect(r1.headers.get("payment-response")).toBeTruthy();
    expect(meter.getBalance("k_1")).toBe(7);

    const rReplay = await mw.handleRequest(
      new Request("http://localhost/mcp", { method: "POST", headers: { authorization: "Bearer demo_tok_1", "idempotency-key": "id_1" } }),
      "math.calc",
      3,
      async () => Response.json({ answer: 999 }),
    );
    expect((await rReplay.json()).replayed).toBe(true);
    expect(meter.getBalance("k_1")).toBe(7);

    const rFail = await mw.handleRequest(
      new Request("http://localhost/mcp", { method: "POST", headers: { authorization: "Bearer demo_tok_1", "idempotency-key": "id_fail" } }),
      "math.calc",
      5,
      async () => Response.json({ error: "boom" }, { status: 500 }),
    );
    expect(rFail.status).toBe(500);
    expect(meter.getBalance("k_1")).toBe(7);
  });

  it("3. verifies opt-in non-custodial x402 V2 header and blocks nonce replay", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => Response.json({ isValid: true, payer: "0xabc" })) as typeof fetch;
    try {
      const meter = createMemoryMeterBackend();
      const mw = withMcp402Meter({
        meter,
        x402: { enabled: true, facilitatorUrl: "https://facilitator.example/verify", timeoutMs: 2000 },
      });
      const hdr = btoa(JSON.stringify({ x402Version: 2, nonce: "nonce_unique_123456", payload: {} }));

      const okRes = await mw.handleRequest(
        new Request("http://localhost/mcp", { method: "POST", headers: { "payment-signature": hdr } }),
        "math.calc",
        1,
        async () => Response.json({ ok: true }),
      );
      expect(okRes.status).toBe(200);

      const replayRes = await mw.handleRequest(
        new Request("http://localhost/mcp", { method: "POST", headers: { "payment-signature": hdr } }),
        "math.calc",
        1,
        async () => Response.json({ ok: true }),
      );
      expect(replayRes.status).toBe(409);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

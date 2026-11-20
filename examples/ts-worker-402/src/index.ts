import { Hono } from "hono";
import { createMemoryMeterBackend, withMcp402Meter } from "../../../packages/mcp-402-ts/src/index.js";

export function createStarterApp() {
  const meter = createMemoryMeterBackend();
  const mw = withMcp402Meter({
    meter,
    checkoutUrl: "https://gate.srigenmedia.com/developers/402",
  });
  const app = new Hono();

  app.post("/mcp", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { method?: string; params?: { name?: string; arguments?: any } };
    if (body.method === "tools/list") {
      return c.json({ jsonrpc: "2.0", id: 1, result: { tools: [{ name: "math.compound_interest", units: 2 }] } });
    }
    const tool = String(body.params?.name || "math.compound_interest");
    return mw.handleRequest(c.req.raw, tool, 2, async () => {
      const args = body.params?.arguments ?? {};
      if (args.forceError) return Response.json({ error: "SIMULATED_ERROR" }, { status: 500 });
      const principal = Number(args.principal ?? 1000);
      const rate = Number(args.rate ?? 0.08);
      const years = Number(args.years ?? 5);
      const total = Number((principal * Math.pow(1 + rate, years)).toFixed(2));
      return Response.json({ ok: true, principal, rate, years, total });
    });
  });

  return { app, meter };
}

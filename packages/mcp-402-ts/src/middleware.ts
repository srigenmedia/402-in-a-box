/**
 * withMcp402Meter middleware for Hono, Cloudflare Workers, and Agents SDK MCP tools.
 */
import { build402ChallengeResponse, encodePaymentResponseHeader } from "./challenge402.js";
import { verifyMandateAndTap } from "./mandateAndTap.js";
import type { Mcp402Config, PaymentResponseReceipt } from "./types.js";
import { verifyX402PaymentHeader } from "./x402Verifier.js";

export function withMcp402Meter(config: Mcp402Config) {
  const assetId = config.assetId || "SRG-COMPUTE-UNIT-V1";
  const recipientId = config.recipientId || "mcp402-treasury";
  const checkoutUrl = config.checkoutUrl || "https://gate.srigenmedia.com/developers/402";
  const x402Enabled = Boolean(config.x402?.enabled === true);

  async function handleRequest(
    request: Request,
    toolName: string,
    requiredUnits: number,
    handler: () => Promise<Response>,
  ): Promise<Response> {
    const t0 = Date.now();
    const url = new URL(request.url);
    const authHeader = request.headers.get("authorization");

    if (!authHeader && x402Enabled) {
      const x402 = await verifyX402PaymentHeader(request.headers, requiredUnits, config.x402);
      if (x402.verified) {
        const res = await handler();
        return res;
      }
      if (x402.status !== 402) {
        return Response.json({ ok: false, code: x402.code }, { status: x402.status });
      }
    }

    const auth = await config.meter.verifyKey(authHeader);
    if (!auth.ok) {
      if (auth.status === 402) {
        return build402ChallengeResponse({
          resource: url.pathname,
          toolName,
          requiredUnits,
          assetId,
          recipientId,
          checkoutUrl,
          x402Enabled,
          reason: auth.code,
          skus: config.skus,
        });
      }
      return Response.json({ ok: false, code: auth.code }, { status: auth.status });
    }

    const tapPub = config.tapPublicKeyResolver ? await config.tapPublicKeyResolver(auth.keyId) : null;
    const idempotencyKey = request.headers.get("idempotency-key") || `auto_${crypto.randomUUID()}`;
    const mandate = await verifyMandateAndTap({
      ap2MandateHeader: request.headers.get("x-ap2-mandate-hash"),
      tapSignatureHeader: request.headers.get("x-agent-signature"),
      tapPublicKeyEd25519: tapPub,
      signedPayload: `${toolName}:${idempotencyKey}`,
    });
    if (!mandate.ok) {
      return Response.json({ ok: false, code: mandate.code }, { status: mandate.status });
    }

    const resv = await config.meter.reserve({
      keyId: auth.keyId,
      idempotencyKey,
      units: requiredUnits,
      dailyCapUnits: auth.dailyCapUnits,
    });
    if (!resv.ok) {
      if (resv.status === 402) {
        return build402ChallengeResponse({
          resource: url.pathname,
          toolName,
          requiredUnits,
          assetId,
          recipientId,
          checkoutUrl,
          x402Enabled,
          reason: resv.code,
          skus: config.skus,
        });
      }
      return Response.json({ ok: false, code: resv.code || "RESERVE_FAILED" }, { status: resv.status });
    }

    if (resv.replayed && resv.receipt) {
      return new Response(JSON.stringify({ ok: true, replayed: true, result: resv.cachedResponse, receipt: resv.receipt }), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "payment-response": encodePaymentResponseHeader(resv.receipt),
        },
      });
    }

    try {
      const resp = await handler();
      if (resp.status >= 400) {
        await config.meter.rollback({ keyId: auth.keyId, idempotencyKey, units: requiredUnits });
        return resp;
      }
      const payload = await resp.clone().json().catch(() => ({ ok: true }));
      const receipt: PaymentResponseReceipt = await config.meter.commit({
        keyId: auth.keyId,
        idempotencyKey,
        toolName,
        units: requiredUnits,
        statusCode: resp.status,
        latencyMs: Date.now() - t0,
        ap2MandateHash: mandate.ap2MandateHash,
        responsePayload: payload,
      });
      const out = new Response(resp.body, resp);
      out.headers.set("payment-response", encodePaymentResponseHeader(receipt));
      return out;
    } catch (err) {
      await config.meter.rollback({ keyId: auth.keyId, idempotencyKey, units: requiredUnits });
      return Response.json(
        { ok: false, code: "TOOL_EXECUTION_ERROR", error: err instanceof Error ? err.message : "ERROR" },
        { status: 500 },
      );
    }
  }

  return { handleRequest };
}

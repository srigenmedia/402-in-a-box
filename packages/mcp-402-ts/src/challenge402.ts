/**
 * Dual-rail HTTP 402 Payment Required & PAYMENT-RESPONSE header builders.
 */
import type { PaymentResponseReceipt, SkuOffer } from "./types.js";

export const DEFAULT_SKUS: readonly SkuOffer[] = Object.freeze([
  { skuId: "SKU-PAK-STR", units: 400, inrMinor: 19900, usdMinor: 500 },
  { skuId: "SKU-PAK-BLD", units: 2500, inrMinor: 99900, usdMinor: 2500 },
  { skuId: "SKU-PAK-SCL", units: 12500, inrMinor: 449900, usdMinor: 9900 },
]);

function toBase64Utf8(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return btoa(bin);
}

export function encodePaymentResponseHeader(receipt: PaymentResponseReceipt): string {
  return toBase64Utf8({ x402Version: 2, success: true, ...receipt });
}

export function build402ChallengeResponse(params: {
  resource: string;
  toolName: string;
  requiredUnits: number;
  assetId: string;
  recipientId: string;
  checkoutUrl: string;
  x402Enabled: boolean;
  reason?: string;
  skus?: readonly SkuOffer[];
}): Response {
  const payload = {
    x402Version: 2,
    exactX_402_Enabled: params.x402Enabled,
    assetId: params.assetId,
    requiredUnits: params.requiredUnits,
    toolName: params.toolName,
    resource: params.resource,
  };
  const wwwAuth = [
    `Bearer realm="mcp402-meter", error="insufficient_compute_units", error_description="${params.reason || "Top up compute units"}"`,
    `Payment realm="mcp402-meter", method="fiat-compute-pack", amount="${params.requiredUnits}", currency="${params.assetId}", x402="${String(params.x402Enabled)}"`,
  ].join(", ");

  return new Response(
    JSON.stringify({
      ok: false,
      error: "PAYMENT_REQUIRED",
      code: params.reason || "PAYMENT_REQUIRED",
      x402Version: 2,
      exactX_402_Enabled: params.x402Enabled,
      x402_facilitator: { enabled: params.x402Enabled },
      asset_id: params.assetId,
      required_units: params.requiredUnits,
      tool_name: params.toolName,
      settlement_rails: {
        checkout_url: params.checkoutUrl,
        skus: params.skus ?? DEFAULT_SKUS,
      },
    }),
    {
      status: 402,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "private, no-store",
        "www-authenticate": wwwAuth,
        "payment-required": toBase64Utf8(payload),
      },
    },
  );
}

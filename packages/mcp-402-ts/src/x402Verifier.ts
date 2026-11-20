/**
 * Optional Non-Custodial x402 V2 Verifier (WBS-18).
 * Disabled by default (enabled: false). Never holds private keys or custody.
 */
import type { X402Options } from "./types.js";

const seenNonces = new Set<string>();
const MAX_NONCE_CACHE = 2000;

export interface X402VerifyResult {
  readonly verified: boolean;
  readonly status: number;
  readonly code: string;
  readonly payer?: string;
}

export async function verifyX402PaymentHeader(
  headers: Headers,
  requiredUnits: number,
  options?: X402Options,
): Promise<X402VerifyResult> {
  if (!options?.enabled) {
    return { verified: false, status: 402, code: "X402_DISABLED" };
  }
  const rawSig = headers.get("payment-signature") || headers.get("x-payment");
  if (!rawSig) {
    return { verified: false, status: 402, code: "MISSING_X402_SIGNATURE" };
  }

  let parsed: { x402Version?: number; nonce?: string; payload?: unknown; payer?: string };
  try {
    const decoded = rawSig.trim().startsWith("{") ? rawSig : atob(rawSig.trim());
    parsed = JSON.parse(decoded);
  } catch {
    return { verified: false, status: 400, code: "MALFORMED_X402_HEADER" };
  }

  if (parsed.x402Version !== 2 || !parsed.nonce || typeof parsed.nonce !== "string" || parsed.nonce.length < 8) {
    return { verified: false, status: 400, code: "INVALID_X402_NONCE_OR_VERSION" };
  }
  if (seenNonces.has(parsed.nonce)) {
    return { verified: false, status: 409, code: "X402_NONCE_REPLAYED" };
  }
  if (!options.facilitatorUrl) {
    return { verified: false, status: 503, code: "X402_FACILITATOR_UNCONFIGURED" };
  }

  try {
    const resp = await fetch(options.facilitatorUrl, {
      method: "POST",
      signal: AbortSignal.timeout(options.timeoutMs ?? 3000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        x402Version: 2,
        paymentPayload: parsed,
        paymentRequirements: {
          network: options.network ?? "base-mainnet",
          asset: options.asset ?? "USDC",
          maxAmountRequired: String(requiredUnits),
        },
      }),
    });
    if (!resp.ok) return { verified: false, status: 402, code: "X402_FACILITATOR_REJECTED" };
    const verdict = (await resp.json()) as { isValid?: boolean; payer?: string };
    if (!verdict.isValid) return { verified: false, status: 402, code: "X402_PROOF_INVALID" };

    if (seenNonces.size >= MAX_NONCE_CACHE) seenNonces.clear();
    seenNonces.add(parsed.nonce);
    return { verified: true, status: 200, code: "X402_VERIFIED", payer: verdict.payer ?? parsed.payer };
  } catch {
    return { verified: false, status: 503, code: "X402_FACILITATOR_TIMEOUT" };
  }
}

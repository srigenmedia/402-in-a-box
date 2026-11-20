/**
 * Core types for @srigenmedia/mcp-402 metering middleware.
 */

export type EntitlementTuple = readonly [
  asset_id: string,
  sender_id: string,
  recipient_id: string,
  units: number,
  eligibility_flag: 0 | 1,
];

export interface SkuOffer {
  readonly skuId: string;
  readonly units: number;
  readonly inrMinor: number;
  readonly usdMinor: number;
}

export interface X402Options {
  /** Must explicitly opt-in; defaults to false (disabled for Indian statutory compliance). */
  readonly enabled?: boolean;
  readonly facilitatorUrl?: string;
  readonly timeoutMs?: number;
  readonly network?: string;
  readonly asset?: string;
}

export interface PaymentResponseReceipt {
  readonly assetId: string;
  readonly senderId: string;
  readonly recipientId: string;
  readonly unitsCharged: number;
  readonly remainingUnits: number;
  readonly statusCode: number;
  readonly prevReceiptHash: string;
  readonly receiptHash: string;
  readonly idempotencyKey: string;
  readonly timestampMs: number;
  readonly tuple: EntitlementTuple;
}

export interface ReserveOutcome {
  readonly ok: boolean;
  readonly status: number;
  readonly code?: string;
  readonly replayed?: boolean;
  readonly cachedResponse?: unknown;
  readonly receipt?: PaymentResponseReceipt;
  readonly remainingUnits?: number;
}

export interface MeterBackend {
  verifyKey(authHeader: string | null): Promise<{ ok: true; keyId: string; dailyCapUnits?: number } | { ok: false; status: number; code: string }>;
  reserve(params: { keyId: string; idempotencyKey: string; units: number; dailyCapUnits?: number }): Promise<ReserveOutcome>;
  commit(params: {
    keyId: string;
    idempotencyKey: string;
    toolName: string;
    units: number;
    statusCode: number;
    latencyMs: number;
    ap2MandateHash: string | null;
    responsePayload: unknown;
  }): Promise<PaymentResponseReceipt>;
  rollback(params: { keyId: string; idempotencyKey: string; units: number }): Promise<void>;
}

export interface Mcp402Config {
  readonly assetId?: string;
  readonly recipientId?: string;
  readonly checkoutUrl?: string;
  readonly skus?: readonly SkuOffer[];
  readonly meter: MeterBackend;
  readonly x402?: X402Options;
  readonly tapPublicKeyResolver?: (keyId: string) => Promise<string | null>;
}

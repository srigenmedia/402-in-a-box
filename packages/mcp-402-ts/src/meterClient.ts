/**
 * MeterBackend adapters: Durable Object stub, Hosted Ledger HTTP (https://gate.srigenmedia.com),
 * and deterministic in-memory store for local tests / clean-room starters.
 */
import type { MeterBackend, PaymentResponseReceipt, ReserveOutcome } from "./types.js";

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function createHttpLedgerBackend(ledgerUrl: string, apiKeyVerifier?: MeterBackend["verifyKey"]): MeterBackend {
  const base = ledgerUrl.replace(/\/+$/, "");
  const post = async <T>(path: string, body: unknown): Promise<T> => {
    const r = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await r.json()) as T;
  };
  return {
    verifyKey: apiKeyVerifier ?? (async (authHeader) => {
      if (!authHeader || !authHeader.trim()) return { ok: false, status: 402, code: "MISSING_BEARER_KEY" };
      if (!authHeader.startsWith("Bearer ")) return { ok: false, status: 401, code: "INVALID_API_KEY" };
      const r = await post<{ ok: boolean; keyId?: string; code?: string }>("/v1/ledger/verify-key", { token: authHeader.slice(7).trim() });
      return r.ok && r.keyId ? { ok: true, keyId: r.keyId } : { ok: false, status: 401, code: r.code || "INVALID_API_KEY" };
    }),
    reserve: (p) => post<ReserveOutcome>("/v1/ledger/reserve", p),
    commit: (p) => post<PaymentResponseReceipt>("/v1/ledger/commit", p),
    rollback: async (p) => { await post("/v1/ledger/rollback", p); },
  };
}

export function createMemoryMeterBackend(initialKeys: Record<string, { keyId: string; units: number }> = {}): MeterBackend & {
  mint(rawKey: string, keyId: string, units: number): void;
  getBalance(keyId: string): number;
} {
  const keys = new Map<string, string>();
  const balances = new Map<string, number>();
  const lastHash = new Map<string, string>();
  const idem = new Map<string, { state: "RESERVED" | "COMMITTED"; units: number; cachedResponse?: unknown; receipt?: PaymentResponseReceipt }>();

  for (const [raw, info] of Object.entries(initialKeys)) {
    keys.set(raw, info.keyId);
    balances.set(info.keyId, info.units);
  }

  return {
    mint(rawKey: string, keyId: string, units: number) {
      keys.set(rawKey, keyId);
      balances.set(keyId, (balances.get(keyId) ?? 0) + units);
    },
    getBalance(keyId: string) {
      return balances.get(keyId) ?? 0;
    },
    async verifyKey(authHeader) {
      if (!authHeader || !authHeader.trim()) return { ok: false, status: 402, code: "MISSING_BEARER_KEY" };
      if (!authHeader.startsWith("Bearer ")) return { ok: false, status: 401, code: "INVALID_API_KEY" };
      const token = authHeader.slice(7).trim();
      const keyId = keys.get(token);
      if (!keyId) return { ok: false, status: 401, code: "INVALID_API_KEY" };
      return { ok: true, keyId };
    },
    async reserve(p) {
      const k = `${p.keyId}:${p.idempotencyKey}`;
      const prev = idem.get(k);
      if (prev) {
        if (prev.state === "COMMITTED") {
          return { ok: true, status: 200, replayed: true, cachedResponse: prev.cachedResponse, receipt: prev.receipt, remainingUnits: balances.get(p.keyId) ?? 0 };
        }
        return { ok: false, status: 409, code: "IDEMPOTENCY_KEY_IN_FLIGHT" };
      }
      const cur = balances.get(p.keyId) ?? 0;
      if (cur < p.units) return { ok: false, status: 402, code: "INSUFFICIENT_COMPUTE_UNITS", remainingUnits: cur };
      balances.set(p.keyId, cur - p.units);
      idem.set(k, { state: "RESERVED", units: p.units });
      return { ok: true, status: 200, replayed: false, remainingUnits: cur - p.units };
    },
    async commit(p) {
      const k = `${p.keyId}:${p.idempotencyKey}`;
      const prevH = lastHash.get(p.keyId) ?? "0".repeat(64);
      const now = Date.now();
      const receiptHash = await sha256Hex(`${prevH}|${p.keyId}|${p.idempotencyKey}|${p.toolName}|${p.units}|${p.statusCode}|${now}`);
      lastHash.set(p.keyId, receiptHash);
      const receipt: PaymentResponseReceipt = {
        assetId: "SRG-COMPUTE-UNIT-V1",
        senderId: p.keyId,
        recipientId: "mcp402-treasury",
        unitsCharged: p.units,
        remainingUnits: balances.get(p.keyId) ?? 0,
        statusCode: p.statusCode,
        prevReceiptHash: prevH,
        receiptHash,
        idempotencyKey: p.idempotencyKey,
        timestampMs: now,
        tuple: ["SRG-COMPUTE-UNIT-V1", p.keyId, "mcp402-treasury", p.units, 1],
      };
      idem.set(k, { state: "COMMITTED", units: p.units, cachedResponse: p.responsePayload, receipt });
      return receipt;
    },
    async rollback(p) {
      const k = `${p.keyId}:${p.idempotencyKey}`;
      const prev = idem.get(k);
      if (prev && prev.state === "RESERVED") {
        balances.set(p.keyId, (balances.get(p.keyId) ?? 0) + prev.units);
        idem.delete(k);
      }
    },
  };
}

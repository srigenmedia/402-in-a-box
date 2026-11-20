# `@srigenmedia/mcp-402`

Domain-agnostic **402-in-a-Box** compute credit metering middleware for MCP (`2026-07-28`), Cloudflare Workers, Hono, and A2A endpoints.

## Features
- **Dual-Rail `HTTP 402` Challenge:** Emits RFC 9110 `WWW-Authenticate` (`Bearer` + `Payment`), Base64 `PAYMENT-REQUIRED`, and SKU settlement rails.
- **2PC Metering & Replay Protection:** Atomic `reserve -> execute -> commit / rollback` with 24h `Idempotency-Key` replay and automatic `rollback()` on `>= 400` or timeouts.
- **Hash-Chained Receipts:** Emits Base64 `PAYMENT-RESPONSE` with `[asset_id, sender_id, recipient_id, units, eligibility_flag]` 5-tuple and SHA-256 chain.
- **Agent Identity Hooks:** Google AP2 (`X-AP2-Mandate-Hash`) and Visa TAP Ed25519 (`X-Agent-Signature`).
- **Optional Non-Custodial `x402 V2`:** Disabled by default (`x402: { enabled: false }`). Global self-hosters may opt in with an external facilitator URL; zero private keys or custody held.

## Statutory Safe-Harbor Disclosures (Recommended ToS)
1. **Closed-Loop SaaS Credits:** Compute units (`SRG-COMPUTE-UNIT-V1`) are single-issuer, non-withdrawable, non-transferable SaaS credits (SAC 998315).
2. **Automatic Rollback:** Non-refundable once consumed; 100% automatic unit rollback on any `5xx` or upstream timeout.
3. **Tax & Non-VDA:** 18% GST on domestic INR packs / 0% Export LUT on USD packs; zero VDA/crypto settlement when `x402.enabled = false`.
4. **Stateless Privacy:** Zero personal coordinates or sensitive payloads persisted in compute ledgers.

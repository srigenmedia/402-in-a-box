# 402-in-a-Box + Kavach KYA — Launch Copy

## 1. Hacker News (`Show HN`)
**Title:** Show HN: 402-in-a-Box – HTTP 402 per-tool metering for MCP servers (TS & Python)

We built an open-source HTTP `402 Payment Required` metering toolkit (`@srigenmedia/mcp-402` on npm, `srigen-mcp-402` on PyPI) for Model Context Protocol (`2026-07-28`) servers.

- Unauthenticated `POST /mcp` returns `HTTP 402` with a `PAYMENT-REQUIRED` header and self-documenting top-up JSON.
- Authenticated calls run an atomic reserve -> execute -> commit/rollback loop with 24h `Idempotency-Key` deduplication and `PAYMENT-RESPONSE` receipts.
- Compliant fiat rails out of the box: Razorpay (INR, 18% GST, SAC `998315` closed-loop compute units) and PayPal Orders v2 (USD, 0% Export LUT). `x402` crypto verification is disabled by default (`opt-in` only for non-Indian self-hosters).
- Pairs with Kavach KYA (`kavach.srigenmedia.com`), a `₹0`-custody spend-hold firewall storing only cryptographic intent/mandate hashes.

Live sandbox (25 free units): https://vashishta.srigenmedia.com/developers/402
Discovery card: https://mcp.vashishta.srigenmedia.com/.well-known/agent.json

---

## 2. LinkedIn
AI agents are starting to call external MCP tools autonomously, which means APIs need per-call metering, retry safety, and compliant billing — not just flat monthly seats.

Today we're sharing **402-in-a-Box** (`@srigenmedia/mcp-402` & `srigen-mcp-402`):
1. Standard HTTP `402 Payment Required` challenge/receipt headers (`PAYMENT-REQUIRED` / `PAYMENT-RESPONSE`) for MCP `2026-07-28`.
2. Zero double-debit retries via 24h `Idempotency-Key` + automatic rollback on tool timeout.
3. Built for Indian & global compliance: SAC `998315` closed-loop compute units, Razorpay 18% GST + PayPal 0% Export LUT, and Kavach KYA's `₹0`-custody policy firewall.

Try the 25-unit free sandbox: https://vashishta.srigenmedia.com/developers/402

---

## 3. X / Twitter
Shipped 402-in-a-Box: HTTP `402 Payment Required` metering for any MCP server in TypeScript or Python.

- `npm i @srigenmedia/mcp-402` / `pip install srigen-mcp-402`
- Reserve -> Execute -> Commit/Rollback + 24h `Idempotency-Key`
- Razorpay INR (18% GST) + PayPal USD (0% LUT)
- `₹0`-custody Kavach KYA guardrails

25 free sandbox units: https://vashishta.srigenmedia.com/developers/402

---

## 4. Reddit (`r/MCP`)
**[Open Source] 402-in-a-Box: Drop-in HTTP 402 per-tool metering + 24h Idempotency-Key for MCP servers (TS & Python)**

If you're hosting a Streamable HTTP MCP server (`2026-07-28`) and want per-tool credit metering without building billing plumbing from scratch, check out `@srigenmedia/mcp-402` (TS/Workers) and `srigen-mcp-402` (Python).

- Live endpoint: `https://mcp.vashishta.srigenmedia.com/mcp`
- `/.well-known/agent.json`: `https://mcp.vashishta.srigenmedia.com/.well-known/agent.json`
- Free 25-unit sandbox key: `https://vashishta.srigenmedia.com/developers/402`

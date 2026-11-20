# PulseMCP Submission — 402-in-a-Box

- **Title:** 402-in-a-Box — HTTP 402 Metering & Compute Packs for MCP
- **Remote URL:** `https://mcp.vashishta.srigenmedia.com/mcp`
- **Discovery Card:** `https://mcp.vashishta.srigenmedia.com/.well-known/agent.json`
- **Docs & Sandbox:** `https://vashishta.srigenmedia.com/developers/402`
- **Packages:** `npm i @srigenmedia/mcp-402` | `pip install srigen-mcp-402`

## Summary
Add per-tool HTTP `402 Payment Required` metering, idempotent reserve-commit-rollback execution, and instant fiat top-up packs (Razorpay INR / PayPal USD) to any TypeScript or Python MCP server.

## Quick Verification
1. Unauthenticated `POST https://mcp.vashishta.srigenmedia.com/mcp` returns `HTTP 402` with `PAYMENT-REQUIRED` header and self-documenting top-up JSON.
2. Mint a free 25-unit sandbox key at `https://vashishta.srigenmedia.com/developers/402`.
3. Send `Authorization: Bearer <API_KEY>` + `Idempotency-Key: <UUID>` to receive `HTTP 200` + `PAYMENT-RESPONSE` receipt.

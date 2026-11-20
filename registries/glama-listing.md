# Glama MCP Server Listing — 402-in-a-Box

- **Server Name:** 402-in-a-Box (SriGenMedia Metered Compute MCP)
- **Endpoint (Streamable HTTP):** `https://mcp.vashishta.srigenmedia.com/mcp`
- **Agent Card:** `https://mcp.vashishta.srigenmedia.com/.well-known/agent.json`
- **Developer Sandbox (25 Free Units):** `https://vashishta.srigenmedia.com/developers/402`
- **Open-Source SDKs:** `@srigenmedia/mcp-402` (npm) · `srigen-mcp-402` (PyPI)

## Description
Production HTTP `402 Payment Required` metering for Model Context Protocol (MCP `2026-07-28`) servers. Every tool call is reserve-commit-rollback metered inside Cloudflare Durable Objects (`McpCreditMeterDO`) with 24-hour `Idempotency-Key` protection and `PAYMENT-RESPONSE` receipts.

## Authentication Headers
| Header | Required | Notes |
| :--- | :--- | :--- |
| `Authorization` | Yes (for `200`) | `Bearer <API_KEY>` minted via Developer Portal |
| `Idempotency-Key` | Optional | UUID for safe retries with `0` duplicate debits |
| `X-AP2-Mandate-Hash` | Optional | AP2 / Visa TAP Ed25519 agent mandate header |

## Tool Pricing (`SRG-COMPUTE-UNIT-V1`)
| Tool | Units | Notes |
| :--- | :--- | :--- |
| `ephemeris.compute_varga` | `1` | Deterministic sidereal computation (`SAV=337`) |
| `muhurta.city_hora_window` | `2` | City-calibrated planetary Hora window |
| `jyotisha.niti_synthesis` | `10` | Guardrailed synthesis with automatic rollback on timeout |

## Billing & Compliance
- **Asset:** `SRG-COMPUTE-UNIT-V1` (closed-loop SaaS compute units, SAC `998315`).
- **Fiat Rails:** Razorpay (INR, 18% GST) and PayPal Orders v2 (USD, 0% Export LUT).
- **Crypto (`x402`):** Disabled by default on Indian deployments (`X402_CRYPTO_ENABLED = false`; opt-in only for non-Indian self-hosters).

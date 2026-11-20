# Security Policy

## Scope
This repository contains the clean-room open-source SDKs (`@srigenmedia/mcp-402`, `srigen-mcp-402`), starter templates (`examples/ts-worker-402`, `examples/py-mcp-402`), and public MCP Registry manifests for **402-in-a-Box**.

## Security Guarantees
- **Zero Secrets:** No API keys, gateway secrets, OAuth client secrets, or database credentials are stored in this repository.
- **Idempotency & Rollback:** Metered calls use `Idempotency-Key` deduplication (24-hour window) and automatic credit rollback if tool execution fails or times out.
- **Kavach KYA Zero-Custody Guard:** Spend-hold policies store only cryptographic intent/mandate hashes and `₹0` customer funds.
- **Crypto Opt-In Firewall:** `x402` facilitator verification defaults to `enabled: false` to comply with Indian deployment guardrails.

## Reporting Vulnerabilities
Please report security issues privately through GitHub Security Advisories on `srigenmedia/402-in-a-box` or via the Developer Portal support channel at `https://vashishta.srigenmedia.com/developers/402`. Do not open public issues with exploit details or live credentials.

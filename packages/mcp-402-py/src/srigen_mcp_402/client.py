"""Two-phase reserve/commit/rollback HTTP client with bounded LRU receipt cache."""

from __future__ import annotations

from collections import OrderedDict
from typing import Any

import httpx


class LedgerClient:
    """HTTP client targeting a 402-in-a-Box ledger (e.g., https://gate.srigenmedia.com)."""

    def __init__(
        self,
        ledger_url: str = "https://gate.srigenmedia.com",
        *,
        x402_enabled: bool = False,
        timeout_s: float = 5.0,
        cache_size: int = 512,
        transport: httpx.BaseTransport | None = None,
        async_transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.ledger_url = ledger_url.rstrip("/")
        self.x402_enabled = bool(x402_enabled)
        self.timeout_s = timeout_s
        self._cache_size = max(16, cache_size)
        self._receipt_cache: OrderedDict[str, dict[str, Any]] = OrderedDict()
        self._transport = transport
        self._async_transport = async_transport

    def _cache_get(self, cache_key: str) -> dict[str, Any] | None:
        hit = self._receipt_cache.get(cache_key)
        if hit is not None:
            self._receipt_cache.move_to_end(cache_key)
        return hit

    def _cache_put(self, cache_key: str, value: dict[str, Any]) -> None:
        self._receipt_cache[cache_key] = value
        self._receipt_cache.move_to_end(cache_key)
        while len(self._receipt_cache) > self._cache_size:
            self._receipt_cache.popitem(last=False)

    def _headers(self, auth_token: str | None, idempotency_key: str, x402_sig: str | None) -> dict[str, str]:
        hdrs = {"content-type": "application/json", "idempotency-key": idempotency_key}
        if auth_token:
            hdrs["authorization"] = f"Bearer {auth_token}"
        if self.x402_enabled and x402_sig:
            hdrs["payment-signature"] = x402_sig
        return hdrs

    def reserve_sync(
        self,
        *,
        tool_name: str,
        units: int,
        idempotency_key: str,
        auth_token: str | None,
        x402_sig: str | None = None,
    ) -> tuple[int, dict[str, Any]]:
        cached = self._cache_get(f"{auth_token}:{idempotency_key}")
        if cached is not None:
            return 200, {"ok": True, "replayed": True, **cached}
        with httpx.Client(timeout=self.timeout_s, transport=self._transport) as client:
            r = client.post(
                f"{self.ledger_url}/v1/ledger/reserve",
                headers=self._headers(auth_token, idempotency_key, x402_sig),
                json={"tool_name": tool_name, "units": units, "idempotency_key": idempotency_key},
            )
            return r.status_code, r.json()

    def commit_sync(
        self,
        *,
        tool_name: str,
        units: int,
        idempotency_key: str,
        auth_token: str | None,
        result_payload: Any,
    ) -> dict[str, Any]:
        with httpx.Client(timeout=self.timeout_s, transport=self._transport) as client:
            r = client.post(
                f"{self.ledger_url}/v1/ledger/commit",
                headers=self._headers(auth_token, idempotency_key, None),
                json={"tool_name": tool_name, "units": units, "idempotency_key": idempotency_key, "result": result_payload},
            )
            data = r.json()
            self._cache_put(f"{auth_token}:{idempotency_key}", {"cached_result": result_payload, "receipt": data})
            return data

    def rollback_sync(self, *, units: int, idempotency_key: str, auth_token: str | None) -> None:
        with httpx.Client(timeout=self.timeout_s, transport=self._transport) as client:
            client.post(
                f"{self.ledger_url}/v1/ledger/rollback",
                headers=self._headers(auth_token, idempotency_key, None),
                json={"units": units, "idempotency_key": idempotency_key},
            )

    async def reserve_async(
        self,
        *,
        tool_name: str,
        units: int,
        idempotency_key: str,
        auth_token: str | None,
        x402_sig: str | None = None,
    ) -> tuple[int, dict[str, Any]]:
        cached = self._cache_get(f"{auth_token}:{idempotency_key}")
        if cached is not None:
            return 200, {"ok": True, "replayed": True, **cached}
        async with httpx.AsyncClient(timeout=self.timeout_s, transport=self._async_transport) as client:
            r = await client.post(
                f"{self.ledger_url}/v1/ledger/reserve",
                headers=self._headers(auth_token, idempotency_key, x402_sig),
                json={"tool_name": tool_name, "units": units, "idempotency_key": idempotency_key},
            )
            return r.status_code, r.json()

    async def commit_async(
        self,
        *,
        tool_name: str,
        units: int,
        idempotency_key: str,
        auth_token: str | None,
        result_payload: Any,
    ) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout_s, transport=self._async_transport) as client:
            r = await client.post(
                f"{self.ledger_url}/v1/ledger/commit",
                headers=self._headers(auth_token, idempotency_key, None),
                json={"tool_name": tool_name, "units": units, "idempotency_key": idempotency_key, "result": result_payload},
            )
            data = r.json()
            self._cache_put(f"{auth_token}:{idempotency_key}", {"cached_result": result_payload, "receipt": data})
            return data

    async def rollback_async(self, *, units: int, idempotency_key: str, auth_token: str | None) -> None:
        async with httpx.AsyncClient(timeout=self.timeout_s, transport=self._async_transport) as client:
            await client.post(
                f"{self.ledger_url}/v1/ledger/rollback",
                headers=self._headers(auth_token, idempotency_key, None),
                json={"units": units, "idempotency_key": idempotency_key},
            )

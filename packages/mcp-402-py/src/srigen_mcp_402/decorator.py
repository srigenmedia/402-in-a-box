"""@pay_per_call decorator for sync and async MCPServer / FastMCP tools."""

from __future__ import annotations

import functools
import inspect
import uuid
from collections.abc import Callable
from typing import Any

from .client import LedgerClient
from .exceptions import PaymentRequiredError


def _raise_402(tool_name: str, units: int, sku: str, x402_enabled: bool, data: dict[str, Any]) -> None:
    raise PaymentRequiredError(
        tool_name=tool_name,
        required_units=units,
        sku=sku,
        x402_enabled=x402_enabled,
        settlement_rails=data.get("settlement_rails", {}),
    )


def pay_per_call(
    *,
    units: int = 1,
    sku: str = "SKU-PAK-STR",
    ledger_url: str = "https://gate.srigenmedia.com",
    x402_enabled: bool = False,
    client: LedgerClient | None = None,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Meter an MCP tool via 2PC reserve -> execute -> commit/rollback."""
    active_client = client or LedgerClient(ledger_url=ledger_url, x402_enabled=x402_enabled)

    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        tool_name = fn.__name__

        if inspect.iscoroutinefunction(fn):

            @functools.wraps(fn)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                auth_token = kwargs.pop("_auth_token", None)
                idem_key = kwargs.pop("_idempotency_key", None) or f"py_{uuid.uuid4().hex}"
                x402_sig = kwargs.pop("_x402_signature", None)
                status, data = await active_client.reserve_async(
                    tool_name=tool_name,
                    units=units,
                    idempotency_key=idem_key,
                    auth_token=auth_token,
                    x402_sig=x402_sig,
                )
                if status == 402 or not data.get("ok"):
                    _raise_402(tool_name, units, sku, active_client.x402_enabled, data)
                if data.get("replayed"):
                    return data.get("cached_result")
                try:
                    result = await fn(*args, **kwargs)
                except Exception:
                    await active_client.rollback_async(units=units, idempotency_key=idem_key, auth_token=auth_token)
                    raise
                await active_client.commit_async(
                    tool_name=tool_name,
                    units=units,
                    idempotency_key=idem_key,
                    auth_token=auth_token,
                    result_payload=result,
                )
                return result

            return async_wrapper

        @functools.wraps(fn)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            auth_token = kwargs.pop("_auth_token", None)
            idem_key = kwargs.pop("_idempotency_key", None) or f"py_{uuid.uuid4().hex}"
            x402_sig = kwargs.pop("_x402_signature", None)
            status, data = active_client.reserve_sync(
                tool_name=tool_name,
                units=units,
                idempotency_key=idem_key,
                auth_token=auth_token,
                x402_sig=x402_sig,
            )
            if status == 402 or not data.get("ok"):
                _raise_402(tool_name, units, sku, active_client.x402_enabled, data)
            if data.get("replayed"):
                return data.get("cached_result")
            try:
                result = fn(*args, **kwargs)
            except Exception:
                active_client.rollback_sync(units=units, idempotency_key=idem_key, auth_token=auth_token)
                raise
            active_client.commit_sync(
                tool_name=tool_name,
                units=units,
                idempotency_key=idem_key,
                auth_token=auth_token,
                result_payload=result,
            )
            return result

        return sync_wrapper

    return decorator

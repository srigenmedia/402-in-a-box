import asyncio
import json

import httpx
import pytest

from srigen_mcp_402 import LedgerClient, PaymentRequiredError, pay_per_call


def make_mock_ledger():
    state = {"balance": 10, "rolled_back": 0, "reserved": set()}

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content.decode() or "{}")
        auth = request.headers.get("authorization")
        if request.url.path.endswith("/reserve"):
            if not auth or state["balance"] < body["units"]:
                return httpx.Response(402, json={"ok": False, "error": "PAYMENT_REQUIRED"})
            state["balance"] -= body["units"]
            state["reserved"].add(body["idempotency_key"])
            return httpx.Response(200, json={"ok": True, "remaining": state["balance"]})
        if request.url.path.endswith("/commit"):
            return httpx.Response(200, json={"receipt_hash": "hash_py_1", "remaining": state["balance"]})
        if request.url.path.endswith("/rollback"):
            if body["idempotency_key"] in state["reserved"]:
                state["balance"] += body["units"]
                state["rolled_back"] += 1
            return httpx.Response(200, json={"ok": True, "balance": state["balance"]})
        return httpx.Response(404, json={})

    return state, httpx.MockTransport(handler)


def test_sync_402_commit_replay_and_rollback():
    state, transport = make_mock_ledger()
    client = LedgerClient("https://gate.srigenmedia.com", transport=transport)
    assert client.x402_enabled is False

    @pay_per_call(units=3, client=client)
    def add_numbers(a: int, b: int) -> int:
        return a + b

    with pytest.raises(PaymentRequiredError):
        add_numbers(1, 2)

    assert add_numbers(2, 5, _auth_token="demo_tok_py", _idempotency_key="k1") == 7
    assert state["balance"] == 7

    # Replay via bounded LRU cache: 0 extra debit
    assert add_numbers(2, 5, _auth_token="demo_tok_py", _idempotency_key="k1") == 7
    assert state["balance"] == 7

    @pay_per_call(units=4, client=client)
    def fail_tool() -> None:
        raise RuntimeError("boom")

    with pytest.raises(RuntimeError):
        fail_tool(_auth_token="demo_tok_py", _idempotency_key="k_fail")
    assert state["balance"] == 7
    assert state["rolled_back"] == 1


def test_async_pay_per_call():
    state = {"balance": 5}

    async def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content.decode() or "{}")
        if request.url.path.endswith("/reserve"):
            state["balance"] -= body["units"]
            return httpx.Response(200, json={"ok": True})
        return httpx.Response(200, json={"receipt_hash": "h_async"})

    client = LedgerClient("https://gate.srigenmedia.com", async_transport=httpx.MockTransport(handler))

    @pay_per_call(units=2, client=client)
    async def async_calc(x: int) -> int:
        return x * 10

    res = asyncio.run(async_calc(4, _auth_token="demo_tok_async", _idempotency_key="ka1"))
    assert res == 40
    assert state["balance"] == 3

import json

import httpx
import pytest
from src.server import build_tools
from srigen_mcp_402 import LedgerClient, PaymentRequiredError


def test_py_starter_402_200_rollback():
    state = {"balance": 6, "rollbacks": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content.decode() or "{}")
        auth = request.headers.get("authorization")
        if request.url.path.endswith("/reserve"):
            if not auth or state["balance"] < body["units"]:
                return httpx.Response(402, json={"ok": False})
            state["balance"] -= body["units"]
            return httpx.Response(200, json={"ok": True})
        if request.url.path.endswith("/rollback"):
            state["balance"] += body["units"]
            state["rollbacks"] += 1
            return httpx.Response(200, json={"ok": True})
        return httpx.Response(200, json={"receipt_hash": "starter_h1"})

    client = LedgerClient("https://gate.srigenmedia.com", transport=httpx.MockTransport(handler))
    tools = build_tools(client)
    fn = tools["compound_interest"]

    with pytest.raises(PaymentRequiredError):
        fn(1000.0, 0.1, 2)

    assert fn(1000.0, 0.1, 2, _auth_token="demo_tok_py_st", _idempotency_key="p1") == 1210.0
    assert state["balance"] == 4

    with pytest.raises(ValueError):
        fn(1000.0, 0.1, 2, fail=True, _auth_token="demo_tok_py_st", _idempotency_key="p2")
    assert state["balance"] == 4
    assert state["rollbacks"] == 1

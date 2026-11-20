"""Minimal Python MCPServer starter wrapped with @pay_per_call(units=2)."""

from __future__ import annotations

from srigen_mcp_402 import LedgerClient, pay_per_call


def build_tools(client: LedgerClient):
    @pay_per_call(units=2, client=client)
    def compound_interest(principal: float, rate: float, years: int, fail: bool = False) -> float:
        if fail:
            raise ValueError("SIMULATED_UPSTREAM_FAILURE")
        return round(principal * ((1.0 + rate) ** years), 2)

    return {"compound_interest": compound_interest}

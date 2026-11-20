"""Structured HTTP 402 & metering exceptions for srigen-mcp-402."""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class PaymentRequiredError(Exception):
    """Raised when a metered MCP tool call lacks sufficient compute units (HTTP 402)."""

    tool_name: str
    required_units: int
    asset_id: str = "SRG-COMPUTE-UNIT-V1"
    sku: str = "SKU-PAK-STR"
    x402_enabled: bool = False
    www_authenticate: str = ""
    payment_required_b64: str = ""
    settlement_rails: dict[str, Any] = field(default_factory=dict)
    status_code: int = 402

    def __str__(self) -> str:
        return (
            f"HTTP 402 Payment Required for {self.tool_name}: "
            f"requires {self.required_units} {self.asset_id} (sku={self.sku}, x402={self.x402_enabled})"
        )

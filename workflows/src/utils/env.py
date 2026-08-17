from __future__ import annotations

from decimal import Decimal, InvalidOperation


def parse_int_setting(value: object, name: str) -> int:
    """Parse a required integer setting, accepting decimal/scientific notation."""
    try:
        parsed = Decimal(str(value).strip())
    except (InvalidOperation, ValueError) as error:
        raise ValueError(f"{name} must be an integer value.") from error
    if not parsed.is_finite() or parsed != parsed.to_integral_value():
        raise ValueError(f"{name} must be an integer value.")
    return int(parsed)

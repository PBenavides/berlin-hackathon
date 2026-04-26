"""
Atomic per-property ticket number generation.

Uses PostgreSQL UPDATE … RETURNING for race-free increments.
Format: <PREFIX>-<NUM>  e.g. "GAR-118"
"""
from sqlalchemy.orm import Session
from sqlalchemy import text


def next_ticket_num(db: Session, property_id: str) -> str:
    """
    Atomically increment the counter for the given property and return
    the formatted ticket number (e.g. "GAR-118").

    Raises ValueError if no counter row exists for this property.
    """
    row = db.execute(
        text(
            """
            UPDATE property_ticket_counters
            SET last_num = last_num + 1
            WHERE property_id = :pid
            RETURNING prefix, last_num
            """
        ),
        {"pid": property_id},
    ).fetchone()

    if row is None:
        raise ValueError(
            f"No ticket counter configured for property '{property_id}'. "
            "Run /api/dev/reset or manually insert a row into property_ticket_counters."
        )

    return f"{row.prefix}-{row.last_num}"

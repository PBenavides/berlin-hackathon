#!/usr/bin/env python3
"""
data_loader.py — Incrementally push day-delta data into the Buena ContextOps API.

Each "step" corresponds to one day folder in data/incremental/.
Incoming emails and invoices are read directly from the source files.

Usage:
    python data/jobs/data_loader.py --load --steps 5
    python data/jobs/data_loader.py --load --steps 3 --api http://localhost:8000
    python data/jobs/data_loader.py --load --steps 1 --property-id <uuid>
"""

import argparse
import csv
import email
import json
import sys
import time
from email import policy as email_policy
from pathlib import Path

import requests

# data/incremental/ is two levels up from this file (data/jobs/ → data/)
INCREMENTAL_DIR = Path(__file__).parent.parent / "incremental"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def resolve_property_id(api: str, prop_id: str | None) -> str:
    if prop_id:
        return prop_id
    try:
        r = requests.get(f"{api}/api/v1/properties", timeout=10)
        r.raise_for_status()
    except Exception as e:
        print(f"ERROR: could not reach API at {api}: {e}")
        sys.exit(1)

    props = r.json()
    if not props:
        print("ERROR: no properties found — run the backend seed first (/api/v1/dev/seed).")
        sys.exit(1)

    chosen = props[0]
    print(f"  property: {chosen['name']}  ({chosen['id']})\n")
    return chosen["id"]


def read_eml_body(eml_path: Path) -> str:
    with open(eml_path, "rb") as f:
        msg = email.message_from_bytes(f.read(), policy=email_policy.default)
    part = msg.get_body(preferencelist=("plain",))
    if part:
        return part.get_content().strip()
    raw = msg.get_payload(decode=True)
    return raw.decode("utf-8", errors="replace").strip() if raw else ""


def post_ticket(api: str, property_id: str, payload: dict) -> dict | None:
    try:
        r = requests.post(
            f"{api}/api/v1/tickets",
            json={**payload, "property_id": property_id},
            timeout=60,
        )
        r.raise_for_status()
        return r.json()
    except requests.HTTPError as e:
        print(f"    WARN: {e.response.status_code} — {e.response.text[:120]}")
        return None
    except Exception as e:
        print(f"    WARN: {e}")
        return None


# ---------------------------------------------------------------------------
# Per-day ingestion
# ---------------------------------------------------------------------------


def ingest_emails(day_dir: Path, api: str, property_id: str) -> int:
    index = day_dir / "emails_index.csv"
    if not index.exists():
        return 0

    count = 0
    with open(index, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("direction") != "incoming":
                continue  # skip outgoing replies

            month_dir = row.get("month_dir", "")
            eml_path = day_dir / "emails" / month_dir / row["filename"]
            if not eml_path.exists():
                eml_path = day_dir / "emails" / row["filename"]

            body = read_eml_body(eml_path) if eml_path.exists() else row.get("subject", "")

            ticket = post_ticket(api, property_id, {
                "source": "email",
                "external_id": row["id"],
                "raised_by": row.get("from_email", "unknown"),
                "subject": row.get("subject", "(no subject)"),
                "body": body,
                "status": "open",
            })
            if ticket:
                label = row.get("subject", "")[:55]
                print(f"    + email   {row['id']:<14}  {label}")
                count += 1

    return count


def ingest_invoices(day_dir: Path, api: str, property_id: str) -> int:
    index = day_dir / "rechnungen_index.csv"
    if not index.exists():
        return 0

    count = 0
    with open(index, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            body = (
                f"Eingehende Rechnung\n\n"
                f"Dienstleister: {row.get('dienstleister_firma')} ({row.get('dienstleister_id')})\n"
                f"Rechnungsnr.:  {row.get('rechnungsnr')}\n"
                f"Datum:         {row.get('datum')}\n"
                f"Netto:         {row.get('netto')} EUR\n"
                f"MwSt (19%%):   {row.get('mwst')} EUR\n"
                f"Brutto:        {row.get('brutto')} EUR\n"
                f"IBAN:          {row.get('iban')}"
            )
            ticket = post_ticket(api, property_id, {
                "source": "invoice",
                "external_id": row["id"],
                "raised_by": "system",
                "subject": f"Rechnung: {row.get('dienstleister_firma')} — {row.get('rechnungsnr')}",
                "body": body,
                "status": "open",
            })
            if ticket:
                print(f"    + invoice {row['id']:<14}  {row.get('dienstleister_firma')}  {row.get('brutto')} EUR")
                count += 1

    return count


def load_day(day_index: int, api: str, property_id: str) -> int:
    day_dir = INCREMENTAL_DIR / f"day-{day_index:02d}"
    if not day_dir.exists():
        print(f"  [day-{day_index:02d}] folder not found — stopping.")
        return 0

    manifest = {}
    manifest_path = day_dir / "incremental_manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())

    content_date = manifest.get("content_date", f"day-{day_index:02d}")
    print(f"  [day-{day_index:02d}]  {content_date}")

    count = 0
    count += ingest_emails(day_dir, api, property_id)
    count += ingest_invoices(day_dir, api, property_id)

    print(f"           → {count} ticket(s) created")
    return count


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Incrementally load day-delta data into the Buena ContextOps API."
    )
    parser.add_argument("--load", action="store_true", required=True,
                        help="Trigger the load (required flag).")
    parser.add_argument("--steps", type=int, default=1,
                        help="Number of day-folders to ingest (default: 1).")
    parser.add_argument("--api", default="http://localhost:8000",
                        help="API base URL (default: http://localhost:8000).")
    parser.add_argument("--property-id", dest="property_id", default=None,
                        help="Target property UUID. Auto-selects first property if omitted.")
    args = parser.parse_args()

    print(f"Buena ContextOps — data loader")
    print(f"api={args.api}  steps={args.steps}")
    print()

    property_id = resolve_property_id(args.api, args.property_id)

    total = 0
    for day in range(1, args.steps + 1):
        total += load_day(day, args.api, property_id)
        time.sleep(0.2)

    print(f"\n  total: {total} ticket(s) across {args.steps} day(s).")


if __name__ == "__main__":
    main()

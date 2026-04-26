"""
run_e2e_demo.py — Push-button demo of the 6-phase Mailosaur email flow.

Drives the scenario from the brief by simulating Tenant + Vendor inboxes
against a locally running backend. The agent itself does the real work
(create ticket → call send_email_via_mailosaur → relay vendor reply →
confirm with vendor) — the orchestrator only plays the human roles on
either side.

Usage (with backend on http://localhost:8000):

    python -m app.scripts.run_e2e_demo --property-id <seed-property-id>

Optional flags:
    --backend-url    default http://localhost:8000
    --reply-timeout  seconds to wait for each Mailosaur reply (default 180)
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from typing import Optional

import httpx

from app.config import get_settings
from app.services.mailosaur_client import MailosaurClient


def _addr(server_id: str, prefix: str = "demo") -> str:
    return f"{prefix}@{server_id}.mailosaur.net"


def _print_phase(label: str) -> None:
    print(f"\n=== {label} ===", flush=True)


def _stream_agent_run(
    backend_url: str, ticket_id: str, prompt_hint: Optional[str] = None
) -> None:
    """POST to /api/tickets/{id}/agent-run and print SSE frames as they arrive."""
    url = f"{backend_url}/api/tickets/{ticket_id}/agent-run"
    body = {"prompt_hint": prompt_hint} if prompt_hint else {}
    print(f"[orchestrator] streaming {url}", flush=True)
    with httpx.stream("POST", url, json=body, timeout=None) as resp:
        if resp.status_code >= 400:
            print(f"[orchestrator] agent-run failed: {resp.status_code} {resp.text}", flush=True)
            return
        for line in resp.iter_lines():
            if not line:
                continue
            text = line if isinstance(line, str) else line.decode("utf-8", errors="ignore")
            print(f"  {text}", flush=True)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--property-id", required=True, help="Seeded property UUID")
    p.add_argument("--backend-url", default="http://localhost:8000")
    p.add_argument("--reply-timeout", type=int, default=180)
    args = p.parse_args()

    s = get_settings()
    if not (
        s.mailosaur_api_key
        and s.mailosaur_smtp_pass
        and s.mailosaur_agent_server
        and s.mailosaur_tenant_server
        and s.mailosaur_vendor_server
    ):
        print(
            "[orchestrator] Missing Mailosaur env vars. "
            "Set MAILOSAUR_API_KEY, MAILOSAUR_SMTP_PASS, and the three server IDs.",
            file=sys.stderr,
        )
        return 2

    agent_addr = _addr(s.mailosaur_agent_server, prefix="hermes")
    tenant_addr = _addr(s.mailosaur_tenant_server, prefix="tenant3b")
    vendor_addr = _addr(s.mailosaur_vendor_server, prefix="leaks")

    client = MailosaurClient()
    backend = args.backend_url.rstrip("/")

    # --- Phase 0: clean inboxes -----------------------------------------
    _print_phase("Phase 0 — wiping inboxes")
    client.delete_all_messages(
        [s.mailosaur_agent_server, s.mailosaur_tenant_server, s.mailosaur_vendor_server]
    )

    # --- Phase 1: tenant reports the issue ------------------------------
    _print_phase("Phase 1 — tenant emails the agent")
    tenant_subject = "Bathroom leak recurring (Unit 3B)"
    tenant_body = (
        "Hi, the bathroom in Unit 3B has been leaking again under the sink. "
        "Please send someone to fix it. Available most days after 5pm."
    )
    client.send_smtp(
        from_addr=tenant_addr,
        to_addr=agent_addr,
        subject=tenant_subject,
        body=tenant_body,
    )
    print(f"[orchestrator] sent tenant intake → {agent_addr}", flush=True)

    intake = client.wait_for_message(
        server_id=s.mailosaur_agent_server,
        sent_to=agent_addr,
        timeout_s=args.reply_timeout,
    )
    print(f"[orchestrator] agent inbox received subject='{intake.subject}'", flush=True)

    # --- Phase 2: create the ticket via the existing API -----------------
    _print_phase("Phase 2 — POST /api/tickets")
    payload = {
        "property_id": args.property_id,
        "source": "email",
        "raised_by": tenant_addr,
        "subject": intake.subject,
        "body": intake.text,
    }
    r = httpx.post(f"{backend}/api/tickets", json=payload, timeout=30)
    if r.status_code >= 400:
        print(f"[orchestrator] ticket create failed: {r.status_code} {r.text}", file=sys.stderr)
        return 1
    ticket = r.json()
    ticket_id = ticket["id"]
    ticket_num = ticket.get("num") or ticket_id
    print(f"[orchestrator] ticket created: {ticket_num} ({ticket_id})", flush=True)

    # --- Phase 3: drive the agent — it should email the vendor ----------
    _print_phase("Phase 3 — agent run #1 (expects send_email_via_mailosaur to vendor)")
    # Run the agent in the foreground briefly so it has time to send out the
    # vendor email; once that send happens, the agent's awaiting_reply phase
    # blocks on Mailosaur, and we step in to play the vendor.
    #
    # The simplest reliable thing for a demo is: kick off the run in a
    # background thread, sleep a little, then play the vendor side.
    import threading

    hint_phase3 = (
        f"Send the vendor outreach via send_email_via_mailosaur. "
        f"recipientRole='vendor', recipientAddress='{vendor_addr}', expectReply=true, "
        f"replyTimeoutSeconds={args.reply_timeout}. Subject should reference the ticket; "
        f"body should describe the leak and ask for available timeslots."
    )
    run_thread = threading.Thread(
        target=_stream_agent_run,
        args=(backend, ticket_id, hint_phase3),
        daemon=True,
    )
    run_thread.start()

    # --- Phase 4: vendor receives request, replies with timeslots --------
    _print_phase("Phase 4 — vendor receives outreach, replies with timeslots")
    vendor_inbound = client.wait_for_message(
        server_id=s.mailosaur_vendor_server,
        sent_to=vendor_addr,
        timeout_s=args.reply_timeout,
    )
    print(
        f"[orchestrator] vendor inbox received subject='{vendor_inbound.subject}' from={vendor_inbound.from_addr}",
        flush=True,
    )
    client.send_smtp(
        from_addr=vendor_addr,
        to_addr=vendor_inbound.from_addr or agent_addr,
        subject=f"Re: {vendor_inbound.subject}",
        body="Available Mon 10am or Tue 2pm. Let me know which works.",
    )
    print("[orchestrator] vendor sent timeslot reply", flush=True)

    # Wait for the agent run to finish (it should hit reply_received → done).
    run_thread.join(timeout=args.reply_timeout + 30)

    # --- Phase 5: tenant receives options, replies with choice ----------
    _print_phase("Phase 5 — agent run #2 (relay timeslots to tenant)")
    hint_phase5 = (
        f"The vendor has replied with available timeslots (Mon 10am or Tue 2pm). "
        f"Relay these options to the tenant via send_email_via_mailosaur. "
        f"recipientRole='tenant', recipientAddress='{tenant_addr}', expectReply=true, "
        f"replyTimeoutSeconds={args.reply_timeout}. "
        f"Ask the tenant to pick one slot."
    )
    run_thread2 = threading.Thread(
        target=_stream_agent_run,
        args=(backend, ticket_id, hint_phase5),
        daemon=True,
    )
    run_thread2.start()

    tenant_inbound = client.wait_for_message(
        server_id=s.mailosaur_tenant_server,
        sent_to=tenant_addr,
        timeout_s=args.reply_timeout,
    )
    print(
        f"[orchestrator] tenant inbox received subject='{tenant_inbound.subject}'",
        flush=True,
    )
    client.send_smtp(
        from_addr=tenant_addr,
        to_addr=tenant_inbound.from_addr or agent_addr,
        subject=f"Re: {tenant_inbound.subject}",
        body="Monday 10am works for me, thanks.",
    )
    print("[orchestrator] tenant sent choice", flush=True)

    run_thread2.join(timeout=args.reply_timeout + 30)

    # --- Phase 6: agent confirms with vendor ----------------------------
    _print_phase("Phase 6 — agent run #3 (final vendor confirmation)")
    hint_phase6 = (
        f"The tenant chose Monday 10am. Send a final confirmation to the vendor via "
        f"send_email_via_mailosaur. recipientRole='vendor', recipientAddress='{vendor_addr}', "
        f"expectReply=false. Subject should be 'Confirmed: Mon 10am'; body should confirm the slot. "
        f"After sending, save_memory to record the scheduled repair in the property context."
    )
    run_thread3 = threading.Thread(
        target=_stream_agent_run,
        args=(backend, ticket_id, hint_phase6),
        daemon=True,
    )
    run_thread3.start()

    final_vendor = client.wait_for_message(
        server_id=s.mailosaur_vendor_server,
        sent_to=vendor_addr,
        timeout_s=args.reply_timeout,
    )
    print(
        f"[orchestrator] vendor inbox received final confirmation subject='{final_vendor.subject}'",
        flush=True,
    )
    run_thread3.join(timeout=args.reply_timeout + 30)

    _print_phase("Demo complete")
    print(f"Ticket: {backend}/api/tickets/{ticket_id}/actions", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())

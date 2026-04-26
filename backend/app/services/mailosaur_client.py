"""
mailosaur_client.py — Thin wrapper over the Mailosaur sandbox.

Two responsibilities:
  - Send mail via Mailosaur's SMTP relay (smtplib over SSL, port 465).
  - Poll Mailosaur's REST API for incoming mail addressed to a given inbox.

The official `mailosaur` Python package would do the same; we hit the API
directly to avoid an extra dependency for a hackathon demo. Auth uses the
account API key as the HTTP Basic username (password empty).

Docs: https://mailosaur.com/docs/email-testing/api-reference/
"""
from __future__ import annotations

import smtplib
from dataclasses import dataclass
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Any, Dict, List, Optional

import httpx

from app.config import get_settings


_API_BASE = "https://mailosaur.com/api"


@dataclass
class MailosaurMessage:
    id: str
    subject: str
    text: str
    from_addr: str
    to_addr: str
    received_at: str


class MailosaurClient:
    """Tiny SMTP-send + REST-poll client for the three demo inboxes."""

    def __init__(self, api_key: Optional[str] = None) -> None:
        s = get_settings()
        self.api_key = api_key or s.mailosaur_api_key
        self.smtp_host = s.mailosaur_smtp_host
        self.smtp_port = s.mailosaur_smtp_port
        self.smtp_pass = s.mailosaur_smtp_pass
        if not self.api_key or not self.smtp_pass:
            raise RuntimeError(
                "Mailosaur is not configured: set MAILOSAUR_API_KEY and MAILOSAUR_SMTP_PASS"
            )

    # ------------------------------------------------------------------
    # Outbound (SMTP)
    # ------------------------------------------------------------------

    def send_smtp(
        self,
        *,
        from_addr: str,
        to_addr: str,
        subject: str,
        body: str,
        smtp_user: Optional[str] = None,
    ) -> None:
        """
        Send a plain-text email through Mailosaur's SMTP relay.

        Mailosaur authenticates SMTP with `<server_id>` as the username and the
        account's SMTP password as the password. By default we derive the
        server_id from the `from_addr` domain (`<prefix>@<server_id>.mailosaur.net`).
        Pass `smtp_user` explicitly to override.
        """
        msg = EmailMessage()
        msg["From"] = from_addr
        msg["To"] = to_addr
        msg["Subject"] = subject
        msg.set_content(body)

        user = smtp_user or _server_id_from_addr(from_addr)
        if not user:
            raise ValueError(
                f"Could not derive Mailosaur server_id from from_addr={from_addr!r}; "
                "expected format <local>@<server_id>.mailosaur.net or pass smtp_user= explicitly."
            )

        with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, timeout=30) as smtp:
            smtp.login(user, self.smtp_pass)
            smtp.send_message(msg)

    # ------------------------------------------------------------------
    # Inbound (REST API polling)
    # ------------------------------------------------------------------

    def wait_for_message(
        self,
        *,
        server_id: str,
        sent_to: str,
        timeout_s: int = 120,
        poll_interval_s: float = 2.0,
    ) -> MailosaurMessage:
        """
        Block until a message addressed to `sent_to` lands in `server_id`,
        or raise TimeoutError after `timeout_s`.

        Uses /api/messages/await which long-polls server-side, but we layer
        a client-side loop so the caller's generator can yield phase events
        in between.
        """
        deadline = datetime.now(timezone.utc).timestamp() + timeout_s
        with httpx.Client(auth=(self.api_key, ""), timeout=30) as client:
            while datetime.now(timezone.utc).timestamp() < deadline:
                resp = client.get(
                    f"{_API_BASE}/messages",
                    params={"server": server_id, "sentTo": sent_to, "page": 0, "itemsPerPage": 5},
                )
                resp.raise_for_status()
                items = resp.json().get("items", [])
                if items:
                    # Newest first; pick the latest match.
                    msg_id = items[0]["id"]
                    detail = client.get(f"{_API_BASE}/messages/{msg_id}")
                    detail.raise_for_status()
                    return _parse_message(detail.json())

                # Sleep with the client's transport so we honour the deadline.
                _sleep_until(deadline, poll_interval_s)

        raise TimeoutError(
            f"No message to {sent_to} on server {server_id} within {timeout_s}s"
        )

    def delete_all_messages(self, server_ids: List[str]) -> None:
        """Wipe every inbox in `server_ids`. Idempotent. Safe to run before a demo."""
        with httpx.Client(auth=(self.api_key, ""), timeout=30) as client:
            for sid in server_ids:
                if not sid:
                    continue
                client.delete(f"{_API_BASE}/messages", params={"server": sid})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_message(payload: Dict[str, Any]) -> MailosaurMessage:
    text_body = (payload.get("text") or {}).get("body") or ""
    if not text_body:
        # Fall back to first text part of html body if needed.
        text_body = (payload.get("html") or {}).get("body") or ""
    from_list = payload.get("from") or []
    to_list = payload.get("to") or []
    return MailosaurMessage(
        id=payload.get("id", ""),
        subject=payload.get("subject", ""),
        text=text_body,
        from_addr=(from_list[0].get("email") if from_list else "") or "",
        to_addr=(to_list[0].get("email") if to_list else "") or "",
        received_at=payload.get("received") or "",
    )


def _sleep_until(deadline_ts: float, interval_s: float) -> None:
    import time

    remaining = deadline_ts - datetime.now(timezone.utc).timestamp()
    time.sleep(max(0.0, min(interval_s, remaining)))


def _server_id_from_addr(addr: str) -> Optional[str]:
    """Pull the Mailosaur server ID out of a `<local>@<server>.mailosaur.net` address."""
    if "@" not in addr:
        return None
    domain = addr.split("@", 1)[1]
    if not domain.endswith(".mailosaur.net"):
        return None
    return domain.split(".", 1)[0] or None

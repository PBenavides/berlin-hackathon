"""
slack_service.py — Outbound Slack webhook notification service.

Sends a lightweight notification when an agent proposal is generated for a
property that has a slack_channel configured.

If the webhook URL is missing or the request fails, we log the failure and
continue — the proposal is always created regardless of Slack availability.
"""
from __future__ import annotations

import json
import logging
import urllib.request
import urllib.error

logger = logging.getLogger(__name__)

RISK_EMOJI = {
    "low": "🟢",
    "medium": "🟡",
    "high": "🔴",
    "critical": "🚨",
}


def send_proposal_notification(
    *,
    webhook_url: str,
    property_name: str,
    ticket_subject: str,
    raised_by: str,
    risk_level: str,
    ticket_id: str,
    app_base_url: str,
) -> bool:
    """
    Send a Slack webhook message when a new proposal is generated.

    Returns True if the message was sent successfully, False otherwise.
    Never raises — all errors are caught and logged.
    """
    if not webhook_url:
        logger.debug("[slack] No webhook URL configured — skipping notification")
        return False

    emoji = RISK_EMOJI.get(risk_level.lower(), "⚠")
    ticket_url = f"{app_base_url.rstrip('/')}/tickets/{ticket_id}"

    payload = {
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{emoji} New AI Proposal — {property_name}",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Subject:*\n{ticket_subject}",
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Raised by:*\n{raised_by}",
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Risk Level:*\n{emoji} {risk_level.upper()}",
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Property:*\n{property_name}",
                    },
                ],
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Review Proposal →"},
                        "url": ticket_url,
                        "style": "primary",
                    }
                ],
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": "🤖 _Buena ContextOps — AI-assisted property management_",
                    }
                ],
            },
        ]
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            webhook_url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                logger.info(
                    "[slack] Notification sent for ticket %s (property: %s)",
                    ticket_id,
                    property_name,
                )
                return True
            else:
                logger.warning(
                    "[slack] Webhook returned status %s for ticket %s",
                    resp.status,
                    ticket_id,
                )
                return False
    except urllib.error.URLError as e:
        logger.warning("[slack] Webhook request failed for ticket %s: %s", ticket_id, e)
        return False
    except Exception as e:  # noqa: BLE001
        logger.warning("[slack] Unexpected error sending notification: %s", e)
        return False

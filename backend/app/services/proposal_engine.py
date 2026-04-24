"""
proposal_engine.py — Proposal generation engine.

Implements a stable interface (BaseProposalEngine) with two interchangeable backends:
  - StubProposalEngine  : deterministic, template-matched proposals (fast, reliable)
  - AIProposalEngine    : LLM-backed proposals via OpenRouter (realistic, slower)

The active engine is selected via the PROPOSAL_ENGINE env var (default: "stub").
"""
from __future__ import annotations

import os
import json
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Data contract
# ---------------------------------------------------------------------------

@dataclass
class ProposalData:
    """The output of any proposal engine implementation."""
    proposed_external_action: Dict[str, Any]
    context_delta: Dict[str, Any]
    reasoning: str
    citations: List[Dict[str, Any]]
    policy_evaluation: Dict[str, Any]
    risk_level: str  # low | medium | high | critical
    confidence: float = 0.85


# ---------------------------------------------------------------------------
# Base interface
# ---------------------------------------------------------------------------

class BaseProposalEngine(ABC):
    """Shared interface — both stub and AI implementations must satisfy this."""

    @abstractmethod
    def generate(
        self,
        ticket_subject: str,
        ticket_body: str,
        ticket_raised_by: str,
        context_md: str,
        context_chunks: List[Dict[str, str]],   # [{heading, content}]
        policies: List[Dict[str, Any]],
    ) -> ProposalData:
        ...


# ---------------------------------------------------------------------------
# Stub engine — deterministic, template-matched
# ---------------------------------------------------------------------------

class StubProposalEngine(BaseProposalEngine):
    """
    Matches known ticket patterns to hand-crafted proposals.
    Falls back to a sensible generic proposal for unknown tickets.
    """

    def generate(
        self,
        ticket_subject: str,
        ticket_body: str,
        ticket_raised_by: str,
        context_md: str,
        context_chunks: List[Dict[str, str]],
        policies: List[Dict[str, Any]],
    ) -> ProposalData:
        combined = f"{ticket_subject} {ticket_body}".lower()
        chunk_headings = [c["heading"] for c in context_chunks]

        if self._is_recurring_leak(combined):
            return self._proposal_recurring_leak(ticket_raised_by, context_chunks, policies)
        elif self._is_heating_outage(combined):
            return self._proposal_heating_outage(ticket_raised_by, context_chunks, policies)
        elif self._is_noise_complaint(combined):
            return self._proposal_noise_complaint(ticket_raised_by, context_chunks, policies)
        elif self._is_rent_question(combined):
            return self._proposal_rent_question(ticket_raised_by, context_chunks, policies)
        elif self._is_payment_delay(combined):
            return self._proposal_payment_delay(ticket_raised_by, context_chunks, policies)
        else:
            return self._proposal_generic(ticket_subject, ticket_raised_by, context_chunks, policies)

    # --- Pattern matchers ---

    def _is_recurring_leak(self, text: str) -> bool:
        return ("leak" in text or "dripping" in text or "water" in text) and (
            "back" in text or "again" in text or "recurring" in text
        )

    def _is_heating_outage(self, text: str) -> bool:
        return "heating" in text and (
            "not working" in text or "stopped" in text or "no heating" in text
            or "outage" in text or "cold" in text
        )

    def _is_noise_complaint(self, text: str) -> bool:
        return "noise" in text and (
            "every night" in text or "complaint" in text or "loud" in text
            or "after 10" in text or "after 22" in text
        )

    def _is_rent_question(self, text: str) -> bool:
        return ("rent" in text or "lease" in text) and (
            "legal" in text or "rights" in text or "notice" in text or "increase" in text
        )

    def _is_payment_delay(self, text: str) -> bool:
        return ("overdue" in text or "not paid" in text or "payment" in text) and (
            "days" in text or "delay" in text or "month" in text or "rent" in text
        )

    # --- Proposal builders ---

    def _proposal_recurring_leak(
        self,
        raised_by: str,
        chunks: List[Dict],
        policies: List[Dict],
    ) -> ProposalData:
        """
        HIGH RISK: Leak was marked resolved in context but recurred.
        This is a direct conflict with the context's 'resolved' status.
        """
        return ProposalData(
            proposed_external_action={
                "type": "contractor_dispatch_and_tenant_communication",
                "summary": (
                    "Contact Klempnerei Fischer urgently to re-inspect Unit 3B. "
                    "Inform the tenant (Herr Meier) that we have registered the recurrence "
                    "and a technician will be arranged as soon as possible. "
                    "Do NOT promise a same-day visit until appointment is confirmed."
                ),
                "steps": [
                    "Call Klempnerei Fischer (+49 30 XXXXXXX) to schedule urgent re-visit for Unit 3B",
                    "Once appointment confirmed, send tenant notification via email/letter",
                    "Notify owner Klaus Weber (k.weber@example.com) of recurrence — water damage policy",
                    "Document the recurrence in the property context",
                ],
                "draft_message": (
                    "Sehr geehrter Herr Meier,\n\n"
                    "wir haben Ihre erneute Meldung zum Badezimmerleck in Einheit 3B erhalten. "
                    "Wir nehmen dies sehr ernst und haben bereits Kontakt zu unserem Klempner aufgenommen. "
                    "Sobald ein Terminvorschlag vorliegt, werden wir Sie umgehend informieren.\n\n"
                    "Für Rückfragen stehen wir Ihnen gerne zur Verfügung.\n\n"
                    "Mit freundlichen Grüßen\nHausverwaltung"
                ),
            },
            context_delta={
                "learned_facts": [
                    "The bathroom leak in Unit 3B has recurred after being marked resolved on 2026-04-12.",
                    "Contractor Klempnerei Fischer's previous repair appears to have been insufficient.",
                    "The recurrence suggests a systemic plumbing issue, not a one-time fix.",
                ],
                "conflicts": [
                    {
                        "heading": "Known Issues",
                        "conflict": (
                            "Context shows 'Bathroom leak Unit 3B' as RESOLVED (2026-04-12), "
                            "but tenant reports water dripping again. Status must be updated to OPEN/RECURRING."
                        ),
                        "severity": "high",
                    }
                ],
                "missing_info": [
                    "Exact source of the leak (pipe vs. ceiling vs. structural)",
                    "Whether the contractor's repair was temporary or permanent",
                    "Whether building insurance covers repeated leak repairs",
                ],
                "risk_label": "high",
                "suggested_context_update": (
                    "## Known Issues\n"
                    "- **Bathroom leak Unit 3B** ⚠️ RECURRING: First reported 2026-03-10. "
                    "Contractor (Klempnerei Fischer) visited 2026-04-10, reported fixed. "
                    "Tenant confirmed 2026-04-12. **Recurrence reported 2026-04-24** — "
                    "re-inspection required. Possible systemic plumbing issue."
                ),
            },
            reasoning=(
                "The ticket reports a recurrence of the bathroom leak in Unit 3B. "
                "The property context explicitly states this issue was resolved on 2026-04-12 "
                "after contractor visit and tenant confirmation. This is a direct conflict. "
                "Water damage is classified as CRITICAL priority per property policy, requiring "
                "immediate owner and contractor notification. The previous repair by Klempnerei Fischer "
                "appears insufficient — a re-inspection is mandatory. No repair timeline should be "
                "promised until a contractor appointment is confirmed (commitment_guard policy)."
            ),
            citations=[
                {
                    "heading": "Known Issues",
                    "excerpt": (
                        "Bathroom leak Unit 3B: First reported 2026-03-10. "
                        "Contractor (Klempnerei Fischer) visited 2026-04-10, reported fixed. "
                        "Tenant Herr Meier confirmed resolution on 2026-04-12."
                    ),
                    "relevance": "Direct conflict — context shows resolved, ticket shows recurrence",
                },
                {
                    "heading": "Owner Preferences",
                    "excerpt": "No same-day repair commitments without prior confirmation from contractor",
                    "relevance": "Constrains draft message — must not promise a same-day visit",
                },
                {
                    "heading": "Policies",
                    "excerpt": (
                        "Water damage or flooding is critical priority — "
                        "contact owner and contractor immediately"
                    ),
                    "relevance": "Mandates immediate owner (Klaus Weber) and contractor notification",
                },
                {
                    "heading": "Recent Decisions",
                    "excerpt": "2026-04-12: Bathroom leak in 3B marked resolved after contractor visit confirmed by tenant",
                    "relevance": "Establishes the baseline that is now contradicted by this ticket",
                },
            ],
            policy_evaluation={
                "matched_policies": [
                    {
                        "kind": "escalation",
                        "description": "Water damage or flooding is critical priority — contact owner and contractor immediately",
                        "effect": "TRIGGERED — water damage detected, owner and contractor must be notified",
                        "violated": False,
                    },
                    {
                        "kind": "communication",
                        "description": "Do not promise repair timelines unless contractor appointment is confirmed",
                        "effect": "CONSTRAINS draft message — no same-day or timeline promise until appointment confirmed",
                        "violated": False,
                    },
                    {
                        "kind": "approval",
                        "description": "Any expense above €300 requires owner approval from Klaus Weber",
                        "effect": "LIKELY TRIGGERED — re-inspection and repairs may exceed €300",
                        "violated": False,
                    },
                ],
                "violations": [],
                "recommendation": "proceed_with_caution",
                "summary": (
                    "No policy violations detected. Water damage policy mandates immediate escalation. "
                    "Draft message correctly avoids timeline commitments. "
                    "Owner approval likely needed if repair costs exceed €300."
                ),
            },
            risk_level="high",
            confidence=0.95,
        )

    def _proposal_heating_outage(
        self,
        raised_by: str,
        chunks: List[Dict],
        policies: List[Dict],
    ) -> ProposalData:
        return ProposalData(
            proposed_external_action={
                "type": "urgent_contractor_dispatch",
                "summary": (
                    "Contact a licensed heating contractor immediately for Unit 2A. "
                    "Familie Schmidt has a small child — prioritise urgently. "
                    "Notify tenant once appointment is confirmed."
                ),
                "steps": [
                    "Call preferred heating contractor from docs/contractors.md",
                    "If unavailable, escalate to emergency repair service",
                    "Confirm appointment before contacting tenant with details",
                    "Document contractor name and appointment time in ticket",
                ],
                "draft_message": (
                    "Sehr geehrte Familie Schmidt,\n\n"
                    "wir haben Ihre Meldung bezüglich des Heizungsausfalls erhalten und nehmen dies "
                    "mit höchster Priorität. Ein Techniker wurde bereits kontaktiert und wird sich "
                    "schnellstmöglich bei Ihnen melden.\n\n"
                    "Wir entschuldigen uns für die Unannehmlichkeiten.\n\n"
                    "Mit freundlichen Grüßen\nHausverwaltung"
                ),
            },
            context_delta={
                "learned_facts": [
                    "Familie Schmidt (Unit 2A) reported a complete heating failure.",
                    "Family includes a small child, elevating urgency.",
                ],
                "conflicts": [],
                "missing_info": [
                    "Whether the outage affects the entire building or only Unit 2A",
                    "Last maintenance date for the heating system",
                    "Name of the preferred heating contractor",
                ],
                "risk_label": "medium",
                "suggested_context_update": (
                    "## Known Issues\n"
                    "- **Heating outage Unit 2A** (2026-04-24): Familie Schmidt reported complete heating failure. "
                    "Contractor dispatched. Investigation pending."
                ),
            },
            reasoning=(
                "Heating outage with a young child present. While April is outside the Oct–Mar winter SLA window, "
                "this is still urgent. Contractor must be contacted first, then tenant informed with confirmed details. "
                "No timeline commitments before appointment is confirmed."
            ),
            citations=[
                {
                    "heading": "Units & Tenants",
                    "excerpt": "Unit 2A (1st floor, 72m²): Familie Schmidt — 4 persons, tenant since 2018",
                    "relevance": "Confirms family size — small child context elevates urgency",
                },
                {
                    "heading": "Policies",
                    "excerpt": "Heating outage during winter months (Oct–Mar) is high urgency — respond within 2 hours",
                    "relevance": "April is outside the winter SLA, but urgency remains given child in household",
                },
                {
                    "heading": "Owner Preferences",
                    "excerpt": "No same-day repair commitments without prior confirmation from contractor",
                    "relevance": "Draft message must not promise a specific repair time",
                },
            ],
            policy_evaluation={
                "matched_policies": [
                    {
                        "kind": "urgency",
                        "description": "Heating outage during Oct–Mar is high urgency — respond within 2 hours",
                        "effect": "PARTIALLY APPLICABLE — April is outside winter SLA, but family with child warrants urgency",
                        "violated": False,
                    },
                    {
                        "kind": "communication",
                        "description": "Do not promise repair timelines unless contractor appointment is confirmed",
                        "effect": "CONSTRAINS draft message",
                        "violated": False,
                    },
                ],
                "violations": [],
                "recommendation": "proceed",
                "summary": "No violations. Heating outage is urgent regardless of season given small child present.",
            },
            risk_level="medium",
            confidence=0.88,
        )

    def _proposal_noise_complaint(
        self,
        raised_by: str,
        chunks: List[Dict],
        policies: List[Dict],
    ) -> ProposalData:
        return ProposalData(
            proposed_external_action={
                "type": "owner_escalation",
                "summary": (
                    "Context shows a first written warning was already issued (2026-04-21). "
                    "Per noise policy, this appears to be a continuation — escalate to owner Ingrid Sommer."
                ),
                "steps": [
                    "Review prior written warning sent to Herr Lange (2026-04-21)",
                    "Determine if this is a new incident or continuation of prior complaint",
                    "If continuation: escalate to owner Ingrid Sommer with full case summary",
                    "Send acknowledgement to Frau Koch (2B) that the matter is being escalated",
                ],
                "draft_message": (
                    "Sehr geehrte Frau Koch,\n\n"
                    "vielen Dank für Ihre erneute Meldung. Wir haben die Situation geprüft und werden "
                    "entsprechend den Hausordnungsregeln weitere Schritte einleiten. "
                    "Die Eigentümerin wird über den Sachverhalt informiert.\n\n"
                    "Mit freundlichen Grüßen\nHausverwaltung"
                ),
            },
            context_delta={
                "learned_facts": [
                    "Noise complaint from Unit 2B (Frau Koch) regarding Unit 3B (Herr Lange) continues.",
                    "First written warning was issued 2026-04-21 — this appears to be the second incident.",
                ],
                "conflicts": [],
                "missing_info": [
                    "Exact dates of noise incidents since the warning",
                    "Whether Herr Lange acknowledged the written warning",
                ],
                "risk_label": "medium",
                "suggested_context_update": (
                    "## Known Issues\n"
                    "- **Noise complaint (Unit 2B vs 3B)**: Second report received 2026-04-24. "
                    "First warning issued 2026-04-21. Escalated to owner Ingrid Sommer per policy."
                ),
            },
            reasoning=(
                "Noise policy states: written warning after first report, escalate to owner after second. "
                "Context confirms first warning was issued 2026-04-21. This ticket represents the second "
                "complaint, triggering the escalation step."
            ),
            citations=[
                {
                    "heading": "Known Issues",
                    "excerpt": "Noise complaint (Unit 2B vs 3B): Frau Koch (2B) filed complaint 2026-04-20... First written warning issued to Herr Lange on 2026-04-21.",
                    "relevance": "Confirms this is the second complaint — triggers escalation policy",
                },
                {
                    "heading": "Policies",
                    "excerpt": "Noise complaints: issue written warning after first report, escalate to owner after second",
                    "relevance": "Directly governs the required action sequence",
                },
                {
                    "heading": "Owner Preferences",
                    "excerpt": "Commercial lease decisions require direct owner consultation",
                    "relevance": "Owner Ingrid Sommer must be consulted for escalation",
                },
            ],
            policy_evaluation={
                "matched_policies": [
                    {
                        "kind": "escalation",
                        "description": "Noise complaints: written warning after first report, escalate to owner after second",
                        "effect": "TRIGGERED — this is the second complaint, owner escalation required",
                        "violated": False,
                    },
                ],
                "violations": [],
                "recommendation": "escalate",
                "summary": "Policy mandates owner escalation at the second complaint stage.",
            },
            risk_level="medium",
            confidence=0.90,
        )

    def _proposal_rent_question(
        self,
        raised_by: str,
        chunks: List[Dict],
        policies: List[Dict],
    ) -> ProposalData:
        return ProposalData(
            proposed_external_action={
                "type": "legal_escalation",
                "summary": (
                    "Rent increase legality questions must be escalated to legal counsel before "
                    "any response is given to the tenant. Do not advise on legal rights directly."
                ),
                "steps": [
                    "Forward the tenant's question to legal counsel for review",
                    "Send acknowledgement to Herr Wagner that the matter is under review",
                    "Await legal counsel response before communicating with tenant",
                ],
                "draft_message": (
                    "Sehr geehrter Herr Wagner,\n\n"
                    "vielen Dank für Ihre Anfrage bezüglich der Mieterhöhung. "
                    "Wir werden Ihre Frage an unsere Rechtsabteilung weiterleiten und uns "
                    "baldmöglichst bei Ihnen melden.\n\n"
                    "Mit freundlichen Grüßen\nHausverwaltung"
                ),
            },
            context_delta={
                "learned_facts": [
                    "Herr Wagner (Unit 1B) has questions about the legal validity of a rent increase notice.",
                ],
                "conflicts": [],
                "missing_info": [
                    "Copy of the rent increase notice sent",
                    "Notice period and statutory basis cited in the notice",
                    "Name of legal counsel used by the property",
                ],
                "risk_label": "low",
                "suggested_context_update": (
                    "## Known Issues\n"
                    "- **Rent increase query (Unit 1B)**: Herr Wagner queried legality of rent increase notice (2026-04-24). "
                    "Matter forwarded to legal counsel."
                ),
            },
            reasoning=(
                "Rent increase questions require legal review per policy. Providing direct legal advice "
                "without counsel creates liability. The draft message acknowledges receipt without "
                "admitting any position on the legal question."
            ),
            citations=[
                {
                    "heading": "Policies",
                    "excerpt": "Rent increase notices require legal review before sending to tenants",
                    "relevance": "Legal review mandatory — cannot respond to tenant on legal grounds directly",
                },
                {
                    "heading": "Policies",
                    "excerpt": "Legal, rent, or billing questions must be escalated to human review",
                    "relevance": "Confirms escalation path for this category of inquiry",
                },
                {
                    "heading": "Units & Tenants",
                    "excerpt": "Unit 1B (1st floor, 55m²): Herr Wagner — tenant since 2019, asked about rent increase legality",
                    "relevance": "Context already flags this tenant as having raised a rent increase concern",
                },
            ],
            policy_evaluation={
                "matched_policies": [
                    {
                        "kind": "escalation",
                        "description": "Rent increase notices require legal review before sending to tenants",
                        "effect": "TRIGGERED — legal escalation required before any response",
                        "violated": False,
                    },
                    {
                        "kind": "escalation",
                        "description": "Legal, rent, or billing questions must be escalated to human review",
                        "effect": "TRIGGERED — this is a legal question",
                        "violated": False,
                    },
                ],
                "violations": [],
                "recommendation": "escalate_to_legal",
                "summary": "Both applicable policies require legal review before any tenant response.",
            },
            risk_level="low",
            confidence=0.92,
        )

    def _proposal_payment_delay(
        self,
        raised_by: str,
        chunks: List[Dict],
        policies: List[Dict],
    ) -> ProposalData:
        return ProposalData(
            proposed_external_action={
                "type": "formal_payment_reminder",
                "summary": (
                    "Context shows Herr Bauer has occasional late payments. "
                    "This is the second late payment this year — send a formal reminder and document."
                ),
                "steps": [
                    "Send formal written payment reminder to Herr Bauer (Unit 1B)",
                    "Include reference to the outstanding amount and due date",
                    "Note this is the second occurrence this year in the property context",
                    "If unpaid within 5 business days, escalate to owner Klaus Weber",
                ],
                "draft_message": (
                    "Sehr geehrter Herr Bauer,\n\n"
                    "wir weisen Sie darauf hin, dass die Mietzahlung für den laufenden Monat "
                    "noch aussteht. Bitte überweisen Sie den fälligen Betrag umgehend auf unser Konto.\n\n"
                    "Bei Fragen stehen wir Ihnen gerne zur Verfügung.\n\n"
                    "Mit freundlichen Grüßen\nHausverwaltung"
                ),
            },
            context_delta={
                "learned_facts": [
                    "Herr Bauer (Unit 1B) is 12 days overdue on rent for the current month.",
                    "This is the second late payment this year — a recurring pattern.",
                ],
                "conflicts": [],
                "missing_info": [
                    "The exact amount outstanding",
                    "Whether Herr Bauer has been contacted informally already",
                ],
                "risk_label": "medium",
                "suggested_context_update": (
                    "## Units & Tenants\n"
                    "- **Unit 1B** (Ground floor, 58m²): Herr Bauer — tenant since 2021, "
                    "second late payment this year (2026-04). Formal reminder issued."
                ),
            },
            reasoning=(
                "Context confirms Herr Bauer has 'occasional late payments'. "
                "A second late payment in the same year warrants a formal written reminder "
                "and documentation in the property context for future reference. "
                "If payment is not received, escalation to the owner is appropriate per the approval policy."
            ),
            citations=[
                {
                    "heading": "Units & Tenants",
                    "excerpt": "Unit 1B (Ground floor, 58m²): Herr Bauer — tenant since 2021, occasional late payments",
                    "relevance": "Confirms prior pattern of late payments — this is a repeat occurrence",
                },
                {
                    "heading": "Policies",
                    "excerpt": "Legal, rent, or billing questions must be escalated to human review",
                    "relevance": "If unresolved, escalation to human is required",
                },
                {
                    "heading": "Owner Preferences",
                    "excerpt": "Owner prefers written communication for decisions > €500",
                    "relevance": "Monthly rent likely exceeds €500 — owner prefers written comms",
                },
            ],
            policy_evaluation={
                "matched_policies": [
                    {
                        "kind": "escalation",
                        "description": "Legal, rent, or billing questions must be escalated to human review",
                        "effect": "APPLICABLE — payment matters should involve human oversight if unresolved",
                        "violated": False,
                    },
                ],
                "violations": [],
                "recommendation": "proceed",
                "summary": "Formal reminder is appropriate. Escalate to owner if not resolved within 5 business days.",
            },
            risk_level="medium",
            confidence=0.85,
        )

    def _proposal_generic(
        self,
        subject: str,
        raised_by: str,
        chunks: List[Dict],
        policies: List[Dict],
    ) -> ProposalData:
        """Fallback for unrecognised ticket types."""
        return ProposalData(
            proposed_external_action={
                "type": "human_review_required",
                "summary": (
                    f"This ticket does not match any known template. "
                    f"Human review is required before any action is taken."
                ),
                "steps": [
                    "Review ticket details manually",
                    "Identify appropriate action based on property context and policies",
                    "Respond to tenant if required",
                ],
                "draft_message": None,
            },
            context_delta={
                "learned_facts": [f"New ticket received: {subject}"],
                "conflicts": [],
                "missing_info": ["Full context of the issue — requires manual review"],
                "risk_label": "low",
                "suggested_context_update": None,
            },
            reasoning=(
                "This ticket did not match any recognised pattern in the stub engine. "
                "A human should review and take appropriate action."
            ),
            citations=[
                {
                    "heading": "Owner Preferences",
                    "excerpt": "Tenant disputes to be handled empathetically; escalate to owner if unresolved after 2 exchanges",
                    "relevance": "General escalation guidance applies",
                },
                {
                    "heading": "Policies",
                    "excerpt": "Legal, rent, or billing questions must be escalated to human review",
                    "relevance": "If any legal or billing aspect applies, human review is mandatory",
                },
            ],
            policy_evaluation={
                "matched_policies": [],
                "violations": [],
                "recommendation": "human_review",
                "summary": "No specific policies matched. Manual review recommended.",
            },
            risk_level="low",
            confidence=0.40,
        )


# ---------------------------------------------------------------------------
# AI engine — LLM-backed via OpenRouter
# ---------------------------------------------------------------------------

class AIProposalEngine(BaseProposalEngine):
    """
    LLM-backed proposal engine using OpenRouter (google/gemini-2.5-flash by default).
    Falls back to stub if AI call fails.
    """

    MODEL = "google/gemini-2.5-flash"
    OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

    def __init__(self):
        self.api_key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("OPENAI_API_KEY")
        self._stub = StubProposalEngine()

    def generate(
        self,
        ticket_subject: str,
        ticket_body: str,
        ticket_raised_by: str,
        context_md: str,
        context_chunks: List[Dict[str, str]],
        policies: List[Dict[str, Any]],
    ) -> ProposalData:
        if not self.api_key:
            print("[AIProposalEngine] No API key found — falling back to stub")
            return self._stub.generate(
                ticket_subject, ticket_body, ticket_raised_by,
                context_md, context_chunks, policies,
            )

        try:
            return self._call_llm(
                ticket_subject, ticket_body, ticket_raised_by,
                context_md, context_chunks, policies,
            )
        except Exception as e:
            print(f"[AIProposalEngine] LLM call failed: {e} — falling back to stub")
            return self._stub.generate(
                ticket_subject, ticket_body, ticket_raised_by,
                context_md, context_chunks, policies,
            )

    def _call_llm(
        self,
        ticket_subject: str,
        ticket_body: str,
        ticket_raised_by: str,
        context_md: str,
        context_chunks: List[Dict[str, str]],
        policies: List[Dict[str, Any]],
    ) -> ProposalData:
        import httpx

        system_prompt = (
            "You are a property management AI assistant. "
            "Given a support ticket and a property's live context document, "
            "generate a structured proposal for the property manager to review. "
            "You MUST respond with valid JSON only (no markdown fences)."
        )

        chunk_summary = "\n".join(
            f"## {c['heading']}\n{c['content'][:300]}"
            for c in context_chunks[:8]
        )
        policy_summary = "\n".join(
            f"- [{p.get('kind','?')}] {p.get('description','')}"
            for p in policies[:10]
        )

        user_prompt = f"""
TICKET:
Subject: {ticket_subject}
From: {ticket_raised_by}
Body: {ticket_body}

PROPERTY CONTEXT (sections):
{chunk_summary}

POLICIES:
{policy_summary}

Generate a JSON proposal with these exact keys:
{{
  "proposed_external_action": {{
    "type": "string",
    "summary": "string",
    "steps": ["string"],
    "draft_message": "string or null"
  }},
  "context_delta": {{
    "learned_facts": ["string"],
    "conflicts": [{{"heading": "string", "conflict": "string", "severity": "low|medium|high"}}],
    "missing_info": ["string"],
    "risk_label": "low|medium|high|critical",
    "suggested_context_update": "string or null"
  }},
  "reasoning": "string (2-4 sentences explaining the proposal)",
  "citations": [
    {{"heading": "string", "excerpt": "string", "relevance": "string"}}
  ],
  "policy_evaluation": {{
    "matched_policies": [{{"kind":"string","description":"string","effect":"string","violated":false}}],
    "violations": [],
    "recommendation": "string",
    "summary": "string"
  }},
  "risk_level": "low|medium|high|critical",
  "confidence": 0.85
}}

Requirements:
- At least 2 citations referencing context headings
- Detect any conflict between ticket content and context (e.g. if context says 'resolved' but ticket reports recurrence)
- Identify learned facts, conflicts, missing information
- List matched policies with their effect
- Suggest a context update if the ticket reveals new information
"""

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Buena ContextOps",
        }

        body = {
            "model": self.MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.3,
            "max_tokens": 2048,
        }

        resp = httpx.post(self.OPENROUTER_URL, json=body, headers=headers, timeout=30.0)
        resp.raise_for_status()

        raw = resp.json()["choices"][0]["message"]["content"]
        # Strip any accidental markdown fences
        raw = re.sub(r"^```json\s*", "", raw.strip())
        raw = re.sub(r"\s*```$", "", raw)

        data = json.loads(raw)

        return ProposalData(
            proposed_external_action=data["proposed_external_action"],
            context_delta=data["context_delta"],
            reasoning=data["reasoning"],
            citations=data["citations"],
            policy_evaluation=data["policy_evaluation"],
            risk_level=data["risk_level"],
            confidence=float(data.get("confidence", 0.85)),
        )


# ---------------------------------------------------------------------------
# Factory — select engine based on environment
# ---------------------------------------------------------------------------

def get_proposal_engine() -> BaseProposalEngine:
    """
    Return the active proposal engine.
    Set PROPOSAL_ENGINE=ai to use the LLM-backed engine.
    Default: stub (deterministic, fast, reliable).
    """
    engine_type = os.environ.get("PROPOSAL_ENGINE", "stub").lower()
    if engine_type == "ai":
        return AIProposalEngine()
    return StubProposalEngine()

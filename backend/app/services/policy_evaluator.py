"""
policy_evaluator.py — PolicyEvaluator

Evaluates a set of property policies against a ticket's subject and body.
Returns matched policies, detected violations, and an overall recommendation.

This service is called by the ticket pipeline BEFORE the proposal engine,
and its output is merged into the proposal's policy_evaluation field.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class PolicyMatch:
    kind: str
    description: str
    rule_json: Dict[str, Any]
    triggered: bool
    effect: str
    violated: bool = False
    violation_reason: Optional[str] = None


@dataclass
class PolicyEvaluationResult:
    matched_policies: List[PolicyMatch]
    violations: List[PolicyMatch]
    recommendation: str  # proceed | escalate | block | human_review
    summary: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "matched_policies": [
                {
                    "kind": m.kind,
                    "description": m.description,
                    "effect": m.effect,
                    "violated": m.violated,
                    **({"violation_reason": m.violation_reason} if m.violated else {}),
                }
                for m in self.matched_policies
            ],
            "violations": [
                {
                    "kind": v.kind,
                    "description": v.description,
                    "effect": v.effect,
                    "violation_reason": v.violation_reason,
                }
                for v in self.violations
            ],
            "recommendation": self.recommendation,
            "summary": self.summary,
        }


class PolicyEvaluator:
    """
    Evaluates property policies against an incoming ticket.
    Rule matching is keyword/type-based — deterministic, no LLM required.
    """

    def evaluate(
        self,
        ticket_subject: str,
        ticket_body: str,
        policies: List[Dict[str, Any]],
    ) -> PolicyEvaluationResult:
        combined = f"{ticket_subject} {ticket_body}".lower()
        matched: List[PolicyMatch] = []
        violations: List[PolicyMatch] = []

        for policy in policies:
            rule = policy.get("rule_json", {})
            kind = policy.get("kind", "")
            desc = policy.get("description", "")
            rule_type = rule.get("type", "")

            match = self._evaluate_rule(combined, kind, desc, rule, rule_type)
            if match:
                matched.append(match)
                if match.violated:
                    violations.append(match)

        recommendation = self._derive_recommendation(matched, violations)
        summary = self._build_summary(matched, violations, recommendation)

        return PolicyEvaluationResult(
            matched_policies=matched,
            violations=violations,
            recommendation=recommendation,
            summary=summary,
        )

    def _evaluate_rule(
        self,
        text: str,
        kind: str,
        desc: str,
        rule: Dict,
        rule_type: str,
    ) -> Optional[PolicyMatch]:
        """Map rule types to keyword signals. Returns None if rule is not triggered."""

        if rule_type == "urgency_override":
            issue_type = rule.get("issue_type", "")
            if issue_type == "water_damage" and (
                "water" in text or "leak" in text or "dripping" in text or "flood" in text
            ):
                return PolicyMatch(
                    kind=kind,
                    description=desc,
                    rule_json=rule,
                    triggered=True,
                    effect="TRIGGERED — water damage detected, immediate escalation required",
                )
            if issue_type == "heating_outage" and (
                "heating" in text or "heizung" in text
            ):
                return PolicyMatch(
                    kind=kind,
                    description=desc,
                    rule_json=rule,
                    triggered=True,
                    effect="APPLICABLE — heating outage may require urgent response",
                )

        elif rule_type == "escalation_trigger":
            topics = rule.get("topics", [])
            for topic in topics:
                if topic in text:
                    return PolicyMatch(
                        kind=kind,
                        description=desc,
                        rule_json=rule,
                        triggered=True,
                        effect=f"TRIGGERED — topic '{topic}' detected, human escalation required",
                    )

        elif rule_type == "commitment_guard":
            topic = rule.get("topic", "")
            if topic == "repair_timelines" and (
                "fix" in text or "repair" in text or "today" in text or "tomorrow" in text
            ):
                return PolicyMatch(
                    kind=kind,
                    description=desc,
                    rule_json=rule,
                    triggered=True,
                    effect="CONSTRAINS — no repair timeline promise until contractor appointment confirmed",
                )

        elif rule_type == "expense_threshold":
            # Triggered if the ticket mentions expenses, repairs, or contractor work
            if any(kw in text for kw in ["repair", "fix", "contractor", "cost", "quote", "rechnung", "kosten"]):
                threshold = rule.get("threshold_eur", 300)
                approver = rule.get("approver", "owner")
                return PolicyMatch(
                    kind=kind,
                    description=desc,
                    rule_json=rule,
                    triggered=True,
                    effect=f"POTENTIALLY APPLICABLE — if repair cost exceeds €{threshold}, {approver} approval required",
                )

        elif rule_type == "legal_review_required":
            topic = rule.get("topic", "")
            if topic in text or "legal" in text or "law" in text or "rights" in text:
                return PolicyMatch(
                    kind=kind,
                    description=desc,
                    rule_json=rule,
                    triggered=True,
                    effect="TRIGGERED — legal review required before any response or action",
                )

        elif rule_type == "progressive_escalation":
            issue_type = rule.get("issue_type", "")
            if issue_type == "noise_complaint" and (
                "noise" in text or "loud" in text or "lärm" in text
            ):
                return PolicyMatch(
                    kind=kind,
                    description=desc,
                    rule_json=rule,
                    triggered=True,
                    effect="TRIGGERED — noise complaint detected, follow progressive escalation steps",
                )

        elif rule_type == "owner_only":
            topic = rule.get("topic", "")
            if topic == "commercial_lease" and ("lease" in text or "commercial" in text):
                return PolicyMatch(
                    kind=kind,
                    description=desc,
                    rule_json=rule,
                    triggered=True,
                    effect="TRIGGERED — commercial lease decision requires owner authorization",
                )

        elif rule_type == "tone_requirement":
            # Always applicable for outgoing communications
            return PolicyMatch(
                kind=kind,
                description=desc,
                rule_json=rule,
                triggered=True,
                effect="ALWAYS APPLICABLE — formal Sie-form required in all tenant communications",
            )

        return None

    def _derive_recommendation(
        self,
        matched: List[PolicyMatch],
        violations: List[PolicyMatch],
    ) -> str:
        if violations:
            return "block"

        # Check for escalation triggers
        for m in matched:
            if m.triggered and m.rule_json.get("action") in (
                "escalate_to_human", "block_until_reviewed", "set_priority_critical"
            ):
                return "escalate"
            if m.rule_json.get("type") == "legal_review_required":
                return "escalate_to_legal"
            if m.rule_json.get("type") == "owner_only":
                return "escalate_to_owner"

        if matched:
            return "proceed_with_caution"

        return "proceed"

    def _build_summary(
        self,
        matched: List[PolicyMatch],
        violations: List[PolicyMatch],
        recommendation: str,
    ) -> str:
        if not matched:
            return "No specific policies triggered by this ticket."

        triggered_count = len([m for m in matched if m.triggered])
        violation_count = len(violations)

        parts = [f"{triggered_count} policy/policies triggered."]
        if violation_count:
            parts.append(f"{violation_count} violation(s) detected.")

        effects = [m.effect for m in matched if m.triggered]
        if effects:
            parts.append(" ".join(effects[:2]))

        rec_map = {
            "proceed": "Safe to proceed.",
            "proceed_with_caution": "Proceed carefully following policy constraints.",
            "escalate": "Escalation to human required.",
            "escalate_to_legal": "Legal review required before any action.",
            "escalate_to_owner": "Owner authorization required.",
            "block": "Action blocked due to policy violation.",
        }
        parts.append(rec_map.get(recommendation, "Review recommended."))

        return " ".join(parts)

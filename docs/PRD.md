# Product Requirements Document — Buena ContextOps MVP

*Hackathon target:* Buena — The Context Engine (€2,500)
*Product name:* Buena ContextOps
*Positioning:* Human-reviewed property memory for AI operations
*Timeline:* Hackathon duration (~24–48h)
*Document version:* 2.0
*Last updated:* 2026-04-24

---

## 0. Executive Framing

Slack, emails, PDFs, ERP records, and source documents are not the product. They are inputs.

The product is the *operational command center* where the human property manager controls what AI agents know, what they are allowed to do, and what gets written back into the living property memory.

Buena ContextOps turns daily operational noise into trusted, versioned, human-curated property context.

Most AI tools will try to answer the current ticket faster. Buena ContextOps improves the next one.

---

## 1. Product Thesis

Buena’s hackathon challenge asks for a self-updating ⁠ context.md ⁠ file per property. A markdown file alone is useful, but it is not enough.

A self-updating context file becomes dangerous if the system cannot answer four questions:

 1.⁠ ⁠*What information was used?*
 2.⁠ ⁠*Was it current and trustworthy?*
 3.⁠ ⁠*What is the AI allowed to do with it?*
 4.⁠ ⁠*Who approved the final decision?*

Therefore, the MVP is not just a context generator and not just an AI ticket responder.

It is a *ContextOps layer*:

•⁠  ⁠incoming tickets are interpreted against a property’s living memory,
•⁠  ⁠AI proposes a safe operational action,
•⁠  ⁠AI proposes a context update,
•⁠  ⁠humans approve, edit, or reject both,
•⁠  ⁠approved decisions create a new version of ⁠ context.md ⁠,
•⁠  ⁠future agents use better context than before.

The core product loop is:

	⁠*Ticket in → grounded proposal → human decision → context delta → updated property memory.*

This creates a compounding advantage: every resolved ticket improves the next response.

---

## 2. Problem & Opportunity

Property managers at Buena operate with fragmented knowledge spread across ERPs, emails, PDFs, Slack, and their own heads. When a tenant ticket arrives, the quality of the response depends on whether the human happens to remember the right context.

This does not scale, and it is the operational reason many property managers only react instead of proactively managing.

### Current pain

•⁠  ⁠Property knowledge is scattered across multiple tools.
•⁠  ⁠Human operators spend time searching instead of deciding.
•⁠  ⁠AI agents cannot safely act without reliable context.
•⁠  ⁠Context becomes stale after every ticket unless someone manually updates it.
•⁠  ⁠High-risk property decisions require human judgment and auditability.

### Opportunity

Give every property one *living, versioned, human-curated context document* that automated agents can read before acting, while giving human operators a dedicated WebUI to control that context.

The markdown file is the interface for agents.
The WebUI is the command center for humans.

---

## 3. MVP Goal

Ship a working demo that proves five claims in under 5 minutes:

 1.⁠ ⁠*Every property has a living ⁠ context.md ⁠* that is versioned, diffable, and human-editable.
 2.⁠ ⁠*Every proposal is grounded* in a specific context version with visible citations.
 3.⁠ ⁠*Every proposal includes two separate decisions:* an external action and an internal context update.
 4.⁠ ⁠*Every human decision feeds back* into the property memory through a visible Context Delta.
 5.⁠ ⁠*Every action is auditable*, including context reads, proposal creation, approvals, edits, rejections, and context writes.

### Success criteria for the demo

| # | Criterion                                               | How we show it                                                                |
| - | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1 | A ticket flows end-to-end                               | Click “Simulate Slack Ticket” → ticket appears in inbox                       |
| 2 | Proposal is tied to context                             | Proposal card shows ⁠ context v11 ⁠ + cited sections                            |
| 3 | AI does not just draft; it reasons operationally        | Proposal shows risk, policy matches, and recommended workflow                 |
| 4 | Ticket creates a Context Delta                          | UI shows learned facts, conflicts, missing info, and suggested context update |
| 5 | Human can approve response and memory update separately | Two approval surfaces: “Send/approve action” and “Update memory”              |
| 6 | Context version changes after memory approval           | Version counter increments and diff is visible                                |
| 7 | Policy affects behavior                                 | Edit policy and rerun similar ticket to show changed recommendation           |
| 8 | Slack receives a lightweight notification               | Slack message links into the ticket detail page                               |
| 9 | Audit trail is complete                                 | Audit page shows reads, writes, decisions, and policy changes                 |

---

## 4. Explicit Non-Goals

For the hackathon, we are deliberately not building:

•⁠  ⁠a full property management system,
•⁠  ⁠a generic AI chatbot,
•⁠  ⁠autonomous legal or billing decision-making,
•⁠  ⁠production-grade ERP/email/PDF integrations,
•⁠  ⁠multi-user authentication or role-based access control,
•⁠  ⁠mobile-first experience,
•⁠  ⁠large-scale source ingestion,
•⁠  ⁠per-tenant privacy controls,
•⁠  ⁠advanced analytics dashboards.

The MVP proves the core operating loop, not production infrastructure.

---

## 5. Users & Assumptions

Because the hackathon timeline does not allow user interviews, this PRD is based on explicit, product-led assumptions.

### Primary user: Operator / Property Manager

*Persona:* Maria, a Buena property manager responsible for multiple residential properties. She lives in Slack and email, but she does not trust AI outputs unless she can verify the source.

### Secondary user: AI Engineer / Agent Builder

Needs structured, versioned, agent-readable context that downstream AI agents can consume reliably.

### Core assumptions

| Assumption                                   | Confidence | Risk if wrong | Product response                                                  |
| -------------------------------------------- | ---------- | ------------- | ----------------------------------------------------------------- |
| Property context is fragmented               | High       | High          | Central living ⁠ context.md ⁠ per property                          |
| Operators need source-backed proposals       | High       | High          | Citations and context version shown in every proposal             |
| AI should not directly update risky context  | High       | High          | Human review required for all MVP proposals                       |
| Tickets often reveal new property context    | High       | Medium        | Add Context Delta to every proposal                               |
| Raw markdown is not operator-friendly enough | Medium     | Medium        | WebUI is the human command center; markdown is the agent contract |
| Most teams will build AI ticket drafting     | High       | Medium        | Differentiate by updating property memory after every ticket      |

---

## 6. Core Product Concept

### Buena ContextOps

A human-in-the-loop command center that lets operators:

 1.⁠ ⁠receive operational tickets from Slack or simulated sources,
 2.⁠ ⁠see what context the AI used,
 3.⁠ ⁠review the proposed external action,
 4.⁠ ⁠review the proposed internal memory update,
 5.⁠ ⁠approve, edit, or reject each separately,
 6.⁠ ⁠publish approved updates into a versioned ⁠ context.md ⁠,
 7.⁠ ⁠audit every action afterward.

### Key differentiation

Most AI assistants stop at:

	⁠Ticket → AI draft → human sends.

Buena ContextOps goes further:

	⁠Ticket → AI draft → human decision → context update → better future agent behavior.

The standout feature is the *Context Delta*.

---

## 7. The Context Delta

Every incoming ticket should generate a *Context Delta*: a structured explanation of how the ticket changes or challenges the property’s existing memory.

### Context Delta answers five questions

 1.⁠ ⁠*What did we learn?*
 2.⁠ ⁠*What existing context was used?*
 3.⁠ ⁠*What changed or contradicted existing memory?*
 4.⁠ ⁠*What is missing or uncertain?*
 5.⁠ ⁠*What should be written back into ⁠ context.md ⁠?*

### Example

Ticket:

	⁠“Tenant in Unit 3B says the bathroom leak is back. Contractor said it was fixed last week, but water is dripping again. Can we tell the tenant someone will come today?”

Context Delta:

| Field                   | Example                                                        |
| ----------------------- | -------------------------------------------------------------- |
| Learned fact            | Leak reported again in Unit 3B                                 |
| Existing context used   | Known Issues: Bathroom leak marked resolved on 2026-04-17      |
| Conflict                | Existing context says resolved; new ticket suggests recurrence |
| Missing info            | No confirmed contractor appointment yet                        |
| Risk label              | Recurring maintenance issue; tenant communication risk         |
| Suggested memory update | Reopen bathroom leak issue and mark as recurring               |

### Interface contract

⁠ ts
interface ContextDelta {
  learnedFacts: Array<{
    fact: string;
    source: string;
    confidence?: number;
  }>;
  conflicts: Array<{
    existingFact: string;
    newFact: string;
    severity: "low" | "medium" | "high";
  }>;
  missingInformation: string[];
  riskLabels: string[];
  suggestedContextUpdateMd: string;
}
 ⁠

---

## 8. Core Scenario

 1.⁠ ⁠A ticket lands in the system from Slack or the demo simulator.
 2.⁠ ⁠Maria receives a Slack ping: “New ticket for Gartenstraße 42 — Review in Buena.”
 3.⁠ ⁠She opens the ticket detail page.
 4.⁠ ⁠She sees:

   * original ticket,
   * property and unit match,
   * proposed external response,
   * Context Delta,
   * citations from ⁠ context v11 ⁠,
   * policies evaluated,
   * risk level and confidence.
 5.⁠ ⁠She reviews the proposed external action:

   * approve/send,
   * edit then approve,
   * reject.
 6.⁠ ⁠Separately, she reviews the proposed memory update:

   * approve update to ⁠ context.md ⁠,
   * edit update,
   * reject update.
 7.⁠ ⁠When she approves the memory update, the system creates ⁠ context v12 ⁠.
 8.⁠ ⁠She opens the diff viewer and sees exactly what changed.
 9.⁠ ⁠The audit log shows the full chain of reads, proposal generation, decision, and context write.

---

## 9. Product Principles

 1.⁠ ⁠*Trust before automation*
   AI can propose, but human operators control high-risk actions and long-term memory.

 2.⁠ ⁠*Source-backed by default*
   Every important proposal must show the context version and sections it relied on.

 3.⁠ ⁠*Context improves through work*
   The system should not only resolve tickets; it should learn from them.

 4.⁠ ⁠*Separate action from memory*
   Sending a response and updating property memory are different decisions.

 5.⁠ ⁠*Markdown is the agent contract*
   Humans operate through the WebUI. Agents consume the versioned markdown snapshot.

 6.⁠ ⁠*Policies are visible, not hidden prompts*
   Operators should see the rules that shaped the proposal.

 7.⁠ ⁠*Audit everything that matters*
   Context reads, writes, proposal decisions, and policy changes must be traceable.

---

## 10. Scope — What We Build

### 10.1 The Context Artifact

Each property has exactly one active ⁠ context.md ⁠, with full version history.

#### Structure

•⁠  ⁠YAML frontmatter:

  * ⁠ property_id ⁠
  * ⁠ version ⁠
  * ⁠ updated_at ⁠
  * ⁠ updated_by ⁠
•⁠  ⁠Markdown body organized by headings:

  * ⁠ ## Basics ⁠
  * ⁠ ## Units & Tenants ⁠
  * ⁠ ## Known Issues ⁠
  * ⁠ ## Owner Preferences ⁠
  * ⁠ ## Policies ⁠
  * ⁠ ## Source Documents ⁠
  * ⁠ ## Recent Decisions ⁠

#### Versioning rules

•⁠  ⁠Every write creates a new immutable row.
•⁠  ⁠No in-place edits.
•⁠  ⁠Version numbers are monotonic integers per property, starting at 1.
•⁠  ⁠Every version records ⁠ created_by ⁠ and ⁠ created_reason ⁠.
•⁠  ⁠Every proposal stores the exact ⁠ context_version_id ⁠ it used.

### 10.2 WebUI Features

#### P0 — Must-have for defensible demo

| Feature                     | Description                                       |
| --------------------------- | ------------------------------------------------- |
| Property sidebar            | 2–3 seeded properties                             |
| Context viewer              | Rendered ⁠ context.md ⁠ with section anchors        |
| Latest diff viewer          | Compare previous version to latest version        |
| Version history             | List versions with author, reason, timestamp      |
| Ticket inbox                | Tickets by property and status                    |
| Simulate Slack ticket panel | 4–5 seeded ticket templates                       |
| Ticket detail page          | Original ticket + proposed action + Context Delta |
| Citation panel              | Shows context version and cited sections          |
| Policy evaluation panel     | Shows which policies affected the recommendation  |
| External action review      | Approve, edit, or reject proposed response/action |
| Memory update review        | Approve, edit, or reject suggested context update |
| Audit log                   | Chronological list of reads, writes, decisions    |

#### P1 — Build if time allows

| Feature                | Description                                   |
| ---------------------- | --------------------------------------------- |
| Full context editor    | Raw markdown editor for direct context edits  |
| Policy editor          | Simple CRUD for property policies             |
| Sources page           | Read-only list of source docs / mocked inputs |
| Slack notification     | Outbound webhook with deep link               |
| Arbitrary diff viewer  | Compare any two context versions              |
| Polling or SSE updates | Auto-refresh ticket/proposal status           |

### 10.3 Backend Responsibilities

 1.⁠ ⁠Persist properties, context versions, context chunks, tickets, proposals, policies, sources, and audit entries.
 2.⁠ ⁠Expose REST API endpoints for the WebUI.
 3.⁠ ⁠Accept ticket ingestion through a single endpoint.
 4.⁠ ⁠Trigger proposal generation when a ticket is created.
 5.⁠ ⁠Store proposal outputs with context version references.
 6.⁠ ⁠Store Context Delta as part of each proposal.
 7.⁠ ⁠Let operator decisions update proposal status and optionally create a new context version.
 8.⁠ ⁠Send outbound Slack notification when configured.
 9.⁠ ⁠Record every meaningful read/write/decision in the audit log.

---

## 11. Intelligence Pipeline — Placeholder with Stable Contract

The intelligence layer is intentionally isolated so the team can build the product shell and demo flow in parallel with the AI implementation.

### Proposal Engine

⁠ ts
interface ProposalEngine {
  generateProposal(input: {
    ticket: Ticket;
    property: Property;
    contextVersion: ContextVersion;
    policies: Policy[];
  }): Promise<{
    proposedExternalAction: {
      type: "tenant_email" | "owner_email" | "slack_reply" | "internal_task" | "escalation";
      title: string;
      body: string;
      recipients?: string[];
      recommendedNextStep?: string;
    };
    contextDelta: ContextDelta;
    reasoning: string;
    citations: Array<{
      heading: string;
      excerpt: string;
      chunkId?: string;
    }>;
    confidence?: number;
    riskLevel: "low" | "medium" | "high";
  }>;
}
 ⁠

### Policy Evaluator

⁠ ts
interface PolicyEvaluator {
  evaluate(input: {
    proposedExternalAction: Record<string, unknown>;
    contextDelta: ContextDelta;
    policies: Policy[];
  }): {
    allowed: boolean;
    requiresHumanApproval: boolean;
    matchedPolicies: Array<{
      policyId: string;
      description: string;
      effect: "allow" | "warn" | "require_approval" | "block";
    }>;
    violations: string[];
  };
}
 ⁠

### MVP behavior

•⁠  ⁠The engine may be stubbed or hand-built.
•⁠  ⁠Same ticket + same context + same policies should produce stable output for demo purposes.
•⁠  ⁠The engine does not mutate database state.
•⁠  ⁠The policy evaluator is informational in MVP.
•⁠  ⁠All proposals require human approval in MVP.
•⁠  ⁠The orchestration layer persists proposals, policy results, and audit events.

---

## 12. Data Model

All identifiers are UUIDs unless specified. Timestamps are ⁠ timestamptz ⁠.

### 12.1 ⁠ properties ⁠

| Field           | Type          | Notes                            |
| --------------- | ------------- | -------------------------------- |
| ⁠ id ⁠            | uuid PK       |                                  |
| ⁠ name ⁠          | text          | e.g. “Gartenstraße 42, Berlin”   |
| ⁠ slack_channel ⁠ | text nullable | Target channel for notifications |
| ⁠ created_at ⁠    | timestamptz   |                                  |

### 12.2 ⁠ context_versions ⁠

| Field                | Type                 | Notes                             |
| -------------------- | -------------------- | --------------------------------- |
| ⁠ id ⁠                 | uuid PK              |                                   |
| ⁠ property_id ⁠        | uuid FK → properties |                                   |
| ⁠ version ⁠            | int                  | Monotonic per property            |
| ⁠ content_md ⁠         | text                 | Full markdown                     |
| ⁠ frontmatter ⁠        | jsonb                | Parsed YAML                       |
| ⁠ created_by ⁠         | text                 | Operator email or ⁠ system ⁠        |
| ⁠ created_reason ⁠     | text                 | Free text                         |
| ⁠ parent_version ⁠     | int nullable         | Previous version                  |
| ⁠ source_proposal_id ⁠ | uuid nullable        | Proposal that caused this version |
| ⁠ created_at ⁠         | timestamptz          |                                   |

Unique constraint on ⁠ (property_id, version) ⁠.

### 12.3 ⁠ context_chunks ⁠

| Field                | Type                  | Notes                  |
| -------------------- | --------------------- | ---------------------- |
| ⁠ id ⁠                 | uuid PK               |                        |
| ⁠ context_version_id ⁠ | uuid FK               |                        |
| ⁠ property_id ⁠        | uuid FK               | Denormalized           |
| ⁠ heading ⁠            | text                  | ⁠ ## ⁠ heading           |
| ⁠ content ⁠            | text                  | Chunk body             |
| ⁠ embedding ⁠          | vector(1536) nullable | Optional for retrieval |

### 12.4 ⁠ property_policies ⁠

| Field         | Type        | Notes                                                          |
| ------------- | ----------- | -------------------------------------------------------------- |
| ⁠ id ⁠          | uuid PK     |                                                                |
| ⁠ property_id ⁠ | uuid FK     |                                                                |
| ⁠ kind ⁠        | text        | e.g. ⁠ approval_threshold ⁠, ⁠ tone ⁠, ⁠ forbidden ⁠, ⁠ urgency_rule ⁠ |
| ⁠ rule_json ⁠   | jsonb       | Free-form                                                      |
| ⁠ description ⁠ | text        | Human-readable policy                                          |
| ⁠ active ⁠      | boolean     |                                                                |
| ⁠ created_at ⁠  | timestamptz |                                                                |

### 12.5 ⁠ context_sources ⁠

| Field         | Type                 | Notes                                    |
| ------------- | -------------------- | ---------------------------------------- |
| ⁠ id ⁠          | uuid PK              |                                          |
| ⁠ property_id ⁠ | uuid FK              |                                          |
| ⁠ kind ⁠        | text                 | ⁠ pdf ⁠, ⁠ email ⁠, ⁠ erp ⁠, ⁠ slack ⁠, ⁠ manual ⁠ |
| ⁠ uri ⁠         | text                 | Mocked or real reference                 |
| ⁠ sha256 ⁠      | text nullable        | Optional content hash                    |
| ⁠ status ⁠      | text                 | ⁠ allowed ⁠, ⁠ pending ⁠, ⁠ rejected ⁠         |
| ⁠ approved_by ⁠ | text nullable        |                                          |
| ⁠ approved_at ⁠ | timestamptz nullable |                                          |

### 12.6 ⁠ tickets ⁠

| Field         | Type          | Notes                                                                            |
| ------------- | ------------- | -------------------------------------------------------------------------------- |
| ⁠ id ⁠          | uuid PK       |                                                                                  |
| ⁠ property_id ⁠ | uuid FK       |                                                                                  |
| ⁠ source ⁠      | text          | ⁠ slack ⁠, ⁠ email ⁠, ⁠ api ⁠, ⁠ simulated ⁠                                             |
| ⁠ external_id ⁠ | text nullable | Slack timestamp or external reference                                            |
| ⁠ raised_by ⁠   | text          | e.g. “Herr Schmidt, Unit 3B”                                                     |
| ⁠ subject ⁠     | text          |                                                                                  |
| ⁠ body ⁠        | text          |                                                                                  |
| ⁠ status ⁠      | text          | ⁠ open ⁠, ⁠ proposed ⁠, ⁠ action_approved ⁠, ⁠ memory_approved ⁠, ⁠ rejected ⁠, ⁠ resolved ⁠ |
| ⁠ created_at ⁠  | timestamptz   |                                                                                  |

### 12.7 ⁠ agent_proposals ⁠

Semantically, these are system proposals awaiting human decision.

| Field                      | Type                 | Notes                                                            |
| -------------------------- | -------------------- | ---------------------------------------------------------------- |
| ⁠ id ⁠                       | uuid PK              |                                                                  |
| ⁠ ticket_id ⁠                | uuid FK              |                                                                  |
| ⁠ context_version_id ⁠       | uuid FK              | Exact snapshot used                                              |
| ⁠ proposed_external_action ⁠ | jsonb                | Draft response or operational action                             |
| ⁠ context_delta ⁠            | jsonb                | Learned facts, conflicts, missing info, suggested context update |
| ⁠ reasoning ⁠                | text                 | Human-readable explanation                                       |
| ⁠ citations ⁠                | jsonb                | Array of cited sections/excerpts                                 |
| ⁠ policy_evaluation ⁠        | jsonb nullable       | Output of evaluator                                              |
| ⁠ risk_level ⁠               | text                 | ⁠ low ⁠, ⁠ medium ⁠, ⁠ high ⁠                                          |
| ⁠ confidence ⁠               | numeric nullable     |                                                                  |
| ⁠ action_status ⁠            | text                 | ⁠ pending ⁠, ⁠ approved ⁠, ⁠ edited ⁠, ⁠ rejected ⁠                      |
| ⁠ memory_status ⁠            | text                 | ⁠ pending ⁠, ⁠ approved ⁠, ⁠ edited ⁠, ⁠ rejected ⁠                      |
| ⁠ reviewed_by ⁠              | text nullable        |                                                                  |
| ⁠ reviewed_at ⁠              | timestamptz nullable |                                                                  |
| ⁠ final_external_action ⁠    | jsonb nullable       | What was actually approved                                       |
| ⁠ final_context_update_md ⁠  | text nullable        | What was actually written to memory                              |
| ⁠ rejection_reason ⁠         | text nullable        |                                                                  |
| ⁠ slack_message_ts ⁠         | text nullable        | Future update-in-place                                           |
| ⁠ created_at ⁠               | timestamptz          |                                                                  |

### 12.8 ⁠ audit_log ⁠

| Field         | Type          | Notes                                                                                                                                           |
| ------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| ⁠ id ⁠          | uuid PK       |                                                                                                                                                 |
| ⁠ actor ⁠       | text          | Operator email or ⁠ system ⁠                                                                                                                      |
| ⁠ action ⁠      | text          | e.g. ⁠ context.read ⁠, ⁠ context.write ⁠, ⁠ proposal.create ⁠, ⁠ proposal.action.approve ⁠, ⁠ proposal.memory.approve ⁠, ⁠ policy.update ⁠, ⁠ ticket.create ⁠ |
| ⁠ property_id ⁠ | uuid nullable |                                                                                                                                                 |
| ⁠ entity_type ⁠ | text          |                                                                                                                                                 |
| ⁠ entity_id ⁠   | uuid nullable |                                                                                                                                                 |
| ⁠ metadata ⁠    | jsonb         |                                                                                                                                                 |
| ⁠ created_at ⁠  | timestamptz   |                                                                                                                                                 |

---
## 13. REST API

All responses are JSON. All errors return ⁠ { error: string, details?: unknown } ⁠.

Base path: ⁠ /api/v1 ⁠.

### 13.1 Properties

| Method | Path              | Purpose          |
| ------ | ----------------- | ---------------- |
| ⁠ GET ⁠  | ⁠ /properties ⁠     | List properties  |
| ⁠ GET ⁠  | ⁠ /properties/:id ⁠ | Get one property |

### 13.2 Context

| Method | Path                                        | Purpose                    |
| ------ | ------------------------------------------- | -------------------------- |
| ⁠ GET ⁠  | ⁠ /properties/:id/context ⁠                   | Get latest context version |
| ⁠ GET ⁠  | ⁠ /properties/:id/context/versions ⁠          | List versions              |
| ⁠ GET ⁠  | ⁠ /properties/:id/context/versions/:version ⁠ | Get specific version       |
| ⁠ POST ⁠ | ⁠ /properties/:id/context ⁠                   | Create context version     |
| ⁠ GET ⁠  | ⁠ /properties/:id/context/diff?from=X&to=Y ⁠  | Unified diff               |

### 13.3 Policies

| Method   | Path                       | Purpose       |
| -------- | -------------------------- | ------------- |
| ⁠ GET ⁠    | ⁠ /properties/:id/policies ⁠ | List policies |
| ⁠ POST ⁠   | ⁠ /properties/:id/policies ⁠ | Create policy |
| ⁠ PATCH ⁠  | ⁠ /policies/:policyId ⁠      | Update policy |
| ⁠ DELETE ⁠ | ⁠ /policies/:policyId ⁠      | Delete policy |

### 13.4 Sources

| Method  | Path                      | Purpose                         |
| ------- | ------------------------- | ------------------------------- |
| ⁠ GET ⁠   | ⁠ /properties/:id/sources ⁠ | List mocked/allowlisted sources |
| ⁠ POST ⁠  | ⁠ /properties/:id/sources ⁠ | Register source                 |
| ⁠ PATCH ⁠ | ⁠ /sources/:sourceId ⁠      | Change source status            |

### 13.5 Tickets

| Method | Path                      | Purpose                                     |
| ------ | ------------------------- | ------------------------------------------- |
| ⁠ GET ⁠  | ⁠ /properties/:id/tickets ⁠ | List tickets                                |
| ⁠ GET ⁠  | ⁠ /tickets/:id ⁠            | Get ticket + latest proposal                |
| ⁠ POST ⁠ | ⁠ /tickets ⁠                | Create ticket and trigger proposal pipeline |

Request body:

⁠ json
{
  "property_id": "uuid",
  "source": "slack",
  "raised_by": "Herr Schmidt, Unit 3B",
  "subject": "Bathroom leak is back",
  "body": "The bathroom leak was supposedly fixed last week, but water is dripping again. Can we tell the tenant someone will come today?"
}
 ⁠

### 13.6 Proposals

| Method | Path                            | Purpose                                                       |
| ------ | ------------------------------- | ------------------------------------------------------------- |
| ⁠ GET ⁠  | ⁠ /tickets/:ticketId/proposals ⁠  | List proposals for ticket                                     |
| ⁠ GET ⁠  | ⁠ /proposals/:id ⁠                | Get proposal detail                                           |
| ⁠ POST ⁠ | ⁠ /proposals/:id/action/approve ⁠ | Approve external action                                       |
| ⁠ POST ⁠ | ⁠ /proposals/:id/action/edit ⁠    | Edit then approve external action                             |
| ⁠ POST ⁠ | ⁠ /proposals/:id/action/reject ⁠  | Reject external action                                        |
| ⁠ POST ⁠ | ⁠ /proposals/:id/memory/approve ⁠ | Approve suggested context update; creates new context version |
| ⁠ POST ⁠ | ⁠ /proposals/:id/memory/edit ⁠    | Edit then approve context update; creates new context version |
| ⁠ POST ⁠ | ⁠ /proposals/:id/memory/reject ⁠  | Reject context update                                         |

### 13.7 Audit

| Method | Path                           | Purpose                 |
| ------ | ------------------------------ | ----------------------- |
| ⁠ GET ⁠  | ⁠ /audit?property_id=X&limit=N ⁠ | Paginated audit entries |

### 13.8 Dev / Demo

| Method | Path                   | Purpose                     |
| ------ | ---------------------- | --------------------------- |
| ⁠ POST ⁠ | ⁠ /dev/simulate-ticket ⁠ | Create ticket from template |
| ⁠ POST ⁠ | ⁠ /dev/reset ⁠           | Reseed database             |

---

## 14. System Flows

### 14.1 Ticket ingestion → proposal

 1.⁠ ⁠Client calls ⁠ POST /tickets ⁠ or ⁠ POST /dev/simulate-ticket ⁠.
 2.⁠ ⁠Backend validates and persists ticket with ⁠ status = open ⁠.
 3.⁠ ⁠Backend emits ⁠ audit: ticket.create ⁠.
 4.⁠ ⁠Backend triggers proposal pipeline.
 5.⁠ ⁠Pipeline loads:

   * current context version,
   * active policies,
   * relevant chunks or headings.
 6.⁠ ⁠Pipeline calls ⁠ ProposalEngine.generateProposal(...) ⁠.
 7.⁠ ⁠Pipeline calls ⁠ PolicyEvaluator.evaluate(...) ⁠.
 8.⁠ ⁠Backend persists ⁠ agent_proposals ⁠ with:

   * ⁠ proposed_external_action ⁠,
   * ⁠ context_delta ⁠,
   * citations,
   * policy evaluation,
   * risk level,
   * context version ID.
 9.⁠ ⁠Ticket status becomes ⁠ proposed ⁠.
10.⁠ ⁠Backend emits:

•⁠  ⁠⁠ audit: context.read ⁠,
•⁠  ⁠⁠ audit: proposal.create ⁠.

11.⁠ ⁠Slack notification is sent if configured.
12.⁠ ⁠WebUI surfaces proposal via polling or refresh.

### 14.2 Operator external action decision

Maria reviews the proposed tenant/owner/internal action.

•⁠  ⁠Approve: ⁠ action_status = approved ⁠, final action stored.
•⁠  ⁠Edit: ⁠ action_status = edited ⁠, edited action stored.
•⁠  ⁠Reject: ⁠ action_status = rejected ⁠, reason stored.

This does not automatically update memory.

### 14.3 Operator memory decision

Maria separately reviews the Context Delta and suggested memory update.

•⁠  ⁠Approve: ⁠ memory_status = approved ⁠, new context version created.
•⁠  ⁠Edit: ⁠ memory_status = edited ⁠, edited context update applied, new version created.
•⁠  ⁠Reject: ⁠ memory_status = rejected ⁠, no context version created.

This does not automatically send a response.

### 14.4 Context edit outside ticket

Operator edits context directly through WebUI. Save creates a new context version and audit entry.

### 14.5 Policy change

Operator edits or creates a policy. Future proposals load the new active policy set. Past proposals remain tied to the policies evaluated at creation time.

---

## 15. Slack Notification

Slack is treated as an input/output surface, not the main product.

### MVP behavior

•⁠  ⁠Outbound notification only.
•⁠  ⁠One webhook URL per demo channel.
•⁠  ⁠Notification is sent when a proposal is ready.
•⁠  ⁠If Slack is unavailable, log to console and continue.

Example:

⁠ text
🎫 New ticket for Gartenstraße 42
From: Herr Schmidt, Unit 3B
Subject: Bathroom leak is back
Risk: High — recurring maintenance issue
→ Review in Buena ContextOps: https://buena.local/tickets/abc-123
 ⁠

---

## 16. Seed Data Requirements
Seed data must make the product thesis obvious.

### Properties

Create 2 realistic German properties:

 1.⁠ ⁠Gartenstraße 42, Berlin
 2.⁠ ⁠Lindenallee 18, Hamburg

### Context for each property

Each property needs a high-quality ⁠ context.md ⁠ with:

•⁠  ⁠basic property info,
•⁠  ⁠2–3 units/tenants,
•⁠  ⁠1–2 known issues,
•⁠  ⁠owner preferences,
•⁠  ⁠property-specific policies,
•⁠  ⁠source document references,
•⁠  ⁠recent decisions.

### Required policies

Use concrete, demo-friendly policies:

•⁠  ⁠Do not promise repair timelines unless a contractor appointment is confirmed.
•⁠  ⁠Any expense above €300 requires owner approval.
•⁠  ⁠Legal, rent, or billing questions require human review.
•⁠  ⁠Heating outage during winter is high urgency.
•⁠  ⁠Use a formal but empathetic tone in tenant communication.

### Ticket templates

Create 4–5 templates:

 1.⁠ ⁠Recurring bathroom leak in Unit 3B.
 2.⁠ ⁠Heating outage in winter.
 3.⁠ ⁠Noise complaint from neighboring unit.
 4.⁠ ⁠Lease/rent question requiring human review.
 5.⁠ ⁠Payment delay with billing sensitivity.

The primary demo should use the recurring leak ticket because it shows conflict detection and memory improvement better than a generic support request.

---

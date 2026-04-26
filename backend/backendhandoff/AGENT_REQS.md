# Hermes Agent — Requirements & Tool Spec

> Companion to `frontendhandoff/API.md` (the wire contract) and
> `backendhandoff/OVERNIGHT_RUN.md` (the sprint plan). This file defines
> what the agent BEHIND `/api/chat`, `/api/tickets/:id` proposals, and
> memory updates is allowed to **observe** and **do**.

---

## Why an agent (vs. one-shot completion)

What's there today (post-sprint-2):

- `chat_engine.py` — single streaming completion. Property context is stuffed
  into the system prompt. No tool use, no multi-step reasoning.
- `proposal_engine.py` — pattern-matched stub OR single LLM completion that
  emits structured JSON. No tool use.
- `memory_engine.py` — deterministic template, no LLM.

Limits this hits:
- The chat agent can't say *"Heinz GmbH last visited 3B on 2025-11-08 for €165"*
  unless that line is already in the property context. It can't query.
- It can't take action on the operator's behalf — *"approve the t-7831 proposal"*
  produces text, not a state change.
- The proposal engine doesn't know which vendors are actually assigned to the
  building, only what the prompt told it.

The agent loop fixes all three by giving the LLM **read tools** for
authoritative lookups and **proposed-write tools** that the operator
confirms before they land.

---

## Design principles

1. **Operator-in-the-loop on every write.** The agent never silently mutates
   state. Write tools emit a `proposed_action` over SSE; the operator clicks
   "Confirm" in the UI to actually call the underlying mutation endpoint.
2. **Reuse the REST surface.** Tools are thin wrappers over the
   already-built `/api/...` endpoints. No new business logic in the agent.
3. **Audit everything.** Every tool call (read AND write proposal) is logged
   to `audit_log` with `actor="hermes"`.
4. **Fail soft.** Tool errors return a structured error to the model so it
   can retry or apologise. They never crash the SSE stream.
5. **Cap the loop.** Maximum 6 tool-call turns per user message to bound
   latency and cost. After the cap, the agent must summarise what it has and
   stop.
6. **Streaming first.** Token deltas, tool calls, and proposed actions all
   arrive as discrete SSE events so the frontend can render incrementally.

---

## Tool registry (v1)

Tools split into two classes:

### Read tools (executed immediately, results fed back to the model)

| Tool | Wraps | Purpose |
|------|-------|---------|
| `list_tickets(propertyId?, status?, risk?)` | `GET /api/tickets` | "What's open right now?" |
| `get_ticket(ticketId)` | `GET /api/tickets/:id` | Pull full nested ticket detail |
| `list_escalations()` | `GET /api/escalations` | "What's on fire?" |
| `get_property(propertyId)` | `GET /api/properties/:id` | Resolve building/owner |
| `get_property_context(propertyId)` | `GET /api/properties/:id/context` | Layered context lookup |
| `list_vendors(buildingId?)` | `GET /api/vendors` | Find a candidate vendor |
| `get_vendor(vendorId)` | `GET /api/vendors/:id` | Vendor history (cases) |
| `list_units(propertyId)` | `GET /api/properties/:id/units` | "Who lives in 3B?" |
| `get_owner(ownerId)` | `GET /api/owners/:id` | Owner policies |

### Write tools (emit a `proposed_action` event — operator confirms, frontend then POSTs)

| Tool | Underlying endpoint | Confirmation copy |
|------|---------------------|-------------------|
| `approve_ticket(ticketId)` | `POST /api/tickets/:id/approve` | "Approve & dispatch?" |
| `reject_ticket(ticketId, reason)` | `POST /api/tickets/:id/reject` | "Reject this ticket?" |
| `save_memory(ticketId)` | `POST /api/tickets/:id/memory/save` | "Save context update?" |
| `skip_memory(ticketId)` | `POST /api/tickets/:id/memory/skip` | "Skip memory write?" |
| `propose_context_edit(propertyId, layer, heading, before, after, rationale)` | (no endpoint yet — creates an `Extraction` row with status=`done` and a single proposed diff) | "Edit context?" |

Out of scope for v1: `dispatch_vendor` (happens inside approve), `send_owner_message`
(the wire contract doesn't expose this yet), `complete_vendor_job` (vendor
webhook, not operator).

---

## SSE event protocol

`POST /api/chat` already returns `text/event-stream`. Today's events:

```
event: delta        data: {"text":"..."}
event: done         data: {"messageId":"...", "appliedTo":[]}
```

Add three new event types for the agent loop:

```
event: tool_call    data: {"id":"call_1","name":"get_ticket","args":{"ticketId":"t-7831"}}
event: tool_result  data: {"id":"call_1","ok":true,"summary":"Ticket t-7831 status=proposed"}
event: action_proposal
                    data: {
                      "id":"act_1",
                      "tool":"approve_ticket",
                      "args":{"ticketId":"t-7831"},
                      "rationale":"Heinz GmbH is the preferred HVAC vendor (24h SLA) and €175 is below the €1k board threshold.",
                      "confirmEndpoint":"/api/tickets/t-7831/approve",
                      "confirmMethod":"POST",
                      "confirmBody":{}
                    }
```

`appliedTo` in the final `done` event becomes the list of `{layer, id, version}`
the agent cited or proposed against — populated for v2.

---

## Loop budget & control flow

```
user_message
  └─→ build messages = [system_prompt, history..., user_message]
       loop (max 6 turns):
         response = llm.chat.completions.create(model, messages, tools, stream=True)
         stream tokens as `event: delta`
         if response.tool_calls:
           for each tool_call:
             if read_tool:
               result = execute(tool_call)
               emit `event: tool_call`, `event: tool_result`
               append tool_result message
             if write_tool:
               emit `event: action_proposal`
               append a synthetic tool_result so the model knows we surfaced it
           continue loop
         else:
           emit `event: done`
           break
```

Termination:
- Model emits text without tool calls → `done`.
- Loop hits 6 turns → emit `done` with a message asking for more guidance.
- Tool error → return error JSON to model; let it retry or apologise.

---

## Tool-call payloads (for the LLM)

OpenAI/OpenRouter "tools" schema. Example:

```json
{
  "type": "function",
  "function": {
    "name": "get_ticket",
    "description": "Fetch a ticket with proposal/callSession/vendorJob/memoryProposal nested.",
    "parameters": {
      "type": "object",
      "properties": {"ticketId": {"type": "string"}},
      "required": ["ticketId"]
    }
  }
}
```

All tool schemas live in `app/services/agent_tools.py`. The agent runtime
in `app/services/agent_runtime.py` dispatches calls and wraps results.

---

## Auditing & safety

- Every read-tool call: `audit_log(actor="hermes", action="agent.read.<tool>", entity_*=...)`.
  Cheap to log, invaluable for replay.
- Every action proposal: `audit_log(actor="hermes", action="agent.propose.<tool>", ...)`.
- Confirmation that the operator clicks: already audited by the wrapped
  endpoint (`ticket.approve`, etc.) — no double-logging.
- Rate-limit per chat session: max 6 tool calls (the loop cap).
- Tool args are validated by Pydantic before dispatch; bad args return a
  structured error to the model, never crash the loop.

---

## Failure modes worth pre-mortem'ing

- **Hallucinated IDs.** Model invents `t-9999`. Tool 404s, error fed back,
  model corrects. Don't pre-validate against the DB before the call —
  let the tool be the source of truth.
- **Infinite tool loops.** Loop cap (6) enforced server-side. Track turn
  count in the runtime, not in the prompt.
- **No API key.** Stub mode: skip the LLM entirely. Single canned reply,
  no tool use. Same SSE shape.
- **Tool latency.** Read tools hit the local DB — sub-10ms. No timeout
  needed. Write tools just emit an event — instant.
- **Operator never confirms.** The action proposal is fire-and-forget; the
  agent doesn't wait. Subsequent messages from the operator make the
  decision visible to the next turn (via tool re-fetch).

---

## What changes in code

New:
- `app/services/agent_tools.py` — tool schemas + dispatch table
- `app/services/agent_runtime.py` — loop, OpenRouter tool-calling integration
- `app/api/routes/extract.py` — already exists (L4); add a thin POST helper
  for `propose_context_edit` that creates an Extraction row directly

Modified:
- `app/services/chat_engine.py` — replace single completion with agent loop;
  yield three new SSE event types
- `app/api/routes/chat.py` — pass through new event types unchanged
- `app/api/routes/audit.py` — (none) — audit_log writes via existing service

Out of scope tonight:
- Per-conversation memory / chat history persistence
- Multi-agent coordination
- Skill learning (pattern → tool sequence cache)

---

## Smoke tests

```bash
# 1. Read-only question
curl -N -d '{"message":"What proposals need my approval?","propertyId":"p1"}' \
     -H 'Content-Type: application/json' \
     localhost:8000/api/chat
# expect: tool_call(list_tickets) → tool_result → delta tokens → done

# 2. Write proposal
curl -N -d '{"message":"Approve the heating ticket for 3B","propertyId":"p1"}' \
     -H 'Content-Type: application/json' \
     localhost:8000/api/chat
# expect: tool_call(get_ticket) → tool_result → action_proposal(approve_ticket) → done

# 3. Cap enforcement
# (manual) — feed a question that needs many lookups, verify <=6 tool_call events

# 4. Stub fallback
unset OPENROUTER_API_KEY OPENAI_API_KEY
curl -N -d '{"message":"hi"}' -H 'Content-Type: application/json' localhost:8000/api/chat
# expect: delta tokens (canned reply), done — no tool_call events
```

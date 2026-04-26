export type TicketStatus =
  | "new"
  | "triaged"
  | "proposed"
  | "approved"
  | "awaiting_vendor"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "resolved"
  | "rejected";

export type Risk = "low" | "medium" | "high";
export type Source = "voice" | "email" | "slack" | "manual" | "api";
export type Layer = "vendor" | "owner" | "building" | "property";

export interface Property {
  id: string;
  name: string;
  buildingId: string;
  ownerId: string;
  city: string;
  units: number;
  openTickets: number;
  contextVersion: number;
  phone: string;
  email: string;
}

export interface Unit {
  id: string;
  propertyId: string;
  label: string;
  type: "residential" | "commercial";
  areaQm: number;
  meaPermille: number;
  ownerName: string;
  ownerSince: number;
  tenant: string;
  rentEur: number | null;
  beirat: boolean;
}

export interface ProposalCitation {
  heading: string;
  excerpt: string;
}

export interface PolicyEvaluation {
  code: string;
  name: string;
  passed: boolean;
}

export interface ProposedAction {
  type: string;
  vendor: string;
  vendorId: string;
  trade: string;
  target: string;
  estimateEur: number;
  etaHours: number;
}

export interface Proposal {
  id: string;
  confidence: number;
  contextVersion: number;
  proposedAction: ProposedAction;
  reasoning: string;
  citations: ProposalCitation[];
  policiesEvaluated: PolicyEvaluation[];
}

export interface TranscriptLine {
  spk: "agent" | "tenant" | string;
  t: string;
  text: string;
  en: string;
}

export interface CallSession {
  duration: string;
  callerPhone: string;
  summary: string;
  noiseReductionDb: number;
  transcript: TranscriptLine[];
}

export interface VendorJob {
  vendorId: string;
  sentAt: string;
  accepted: boolean;
  scheduledFor?: string;
  completedAt?: string;
  finalCostEur?: number;
  notes?: string;
}

export interface MemoryProposal {
  text: string;
  targetVersion: number;
  status: "pending" | "saved" | "skipped";
}

export interface Ticket {
  id: string;
  num: string;
  propertyId: string;
  unitId?: string;
  source: Source;
  status: TicketStatus;
  risk: Risk;
  subject: string;
  excerpt: string;
  raisedBy: string;
  raisedByPhone?: string;
  createdAt: string;
  confidence: number;
  // Sprint 2: escalation fields
  escalationReason?: string;
  escalatedAt?: string;
  proposal?: Proposal;
  callSession?: CallSession;
  emailBody?: string;
  vendorJob?: VendorJob;
  memoryProposal?: MemoryProposal;
}

// ---------------------------------------------------------------------------
// Sprint 2: Agent Action types (streaming action cards)
// ---------------------------------------------------------------------------

export type AgentActionStatus =
  | "thinking"
  | "completed"
  | "proposed"
  | "confirmed"
  | "rejected";

export type AgentActionType =
  | "read"
  | "write_proposal"
  | "send_vendor_email"
  | "respond_to_tenant"
  | "send_owner_report"
  | "escalate_to_human"
  | "approve_ticket"
  | "reject_ticket"
  | "save_memory"
  | "skip_memory"
  | "propose_context_edit";

export interface ActionProposalEnvelope {
  tool: string;
  args: Record<string, unknown>;
  confirmEndpoint: string | null;
  confirmMethod: string | null;
  confirmBody: Record<string, unknown> | null;
  label: string;
  // Tool-specific payload fields
  email?: { to: string; vendorName: string; subject: string; body: string; ticketId: string };
  response?: { tenantName: string; channel: string; channelLabel: string; body: string; ticketId: string };
  report?: { ownerName: string; recipient: string; channel: string; format: string; formatLabel: string; content: string; ticketId: string };
  escalation?: { reason: string; triggeringPolicy: string; recommendation: string; ticketId: string };
  diff?: { layer: string; heading: string; before: string; after: string; rationale: string };
}

export interface AgentAction {
  id: string;
  ticketId: string;
  runId: string | null;
  callId: string | null;
  actionType: AgentActionType;
  toolName: string | null;
  label: string | null;
  description: string | null;
  status: AgentActionStatus;
  payload: {
    callId?: string;
    toolName?: string;
    args?: Record<string, unknown>;
    summary?: string;
    result?: unknown;
    proposal?: ActionProposalEnvelope;
  } | null;
  createdAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  trade: string;
  contact: string;
  phone: string;
  email: string;
  rating: number;
  preferred: boolean;
  buildings: string[];
  slaHours: number;
}

export interface VendorCase {
  id: string;
  vendorId: string;
  propertyId: string;
  date: string;
  description: string;
  costEur: number;
  slaMet: boolean;
  rating: number;
}

export interface OwnerDecision {
  date: string;
  text: string;
}

export interface Owner {
  id: string;
  name: string;
  type: "weg" | "private" | "fund" | string;
  contact: string;
  email: string;
  phone: string;
  language: "de" | "en" | string;
  buildingsCount: number;
  unitsCount: number;
  monthlyRevenueEur: number;
  policies: string[];
  decisions: OwnerDecision[];
  notes: string;
}

export interface Building {
  id: string;
  name: string;
  ownerId: string;
  address: string;
  city: string;
  yearBuilt: number;
  units: number;
  systems: Record<string, string>;
  vendors: string[];
  notes: string;
}

export interface PipelineStage {
  id: TicketStatus;
  label: string;
  description: string;
}

export interface ContextLayer {
  raw: string;
}

export interface PropertyContext {
  propertyId: string;
  version: number;
  updatedAt: string;
  layers: {
    vendor: ContextLayer;
    owner: ContextLayer;
    building: ContextLayer;
    property: ContextLayer;
  };
}

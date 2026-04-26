/**
 * demo-constants.ts
 *
 * Runtime constants for the Sprint 4 demo control features.
 * Separated from types.ts so that the pure type/interface file
 * does not contain runtime values (self-fix: types.ts should only
 * export types and interfaces, not executable code).
 */

import type { DemoSpeed, DemoSpeedConfig } from "./types";

export const DEMO_SPEED_CONFIGS: Record<DemoSpeed, DemoSpeedConfig> = {
  slow:   { label: "Slow",   description: "8–10s per ticket · walkthrough",   interTicketMs: 9000 },
  normal: { label: "Normal", description: "3–5s per ticket · standard demo",  interTicketMs: 4000 },
  fast:   { label: "Fast",   description: "1–2s per ticket · quick showcase", interTicketMs: 1500 },
};

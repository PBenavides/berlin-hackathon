/**
 * overview/page.tsx  (Sprint 3 update)
 *
 * Server component — fetches initial data then passes to OverviewClient
 * which handles live polling when auto-solve is active (s3-f3).
 */
import { api } from "@/lib/api";
import { OverviewClient } from "./overview-client";

export default async function OverviewPage() {
  const [tickets, properties] = await Promise.all([
    api.tickets.list(),
    api.properties.list(),
  ]);

  return (
    <OverviewClient
      initialTickets={tickets}
      initialProperties={properties}
    />
  );
}

import { notFound } from "next/navigation";
import {
  ConciergeChat,
  type AttachmentOut,
  type MessageWithAttachments,
  type OwnerMessageOut,
} from "../../../components/ConciergeChat";

const API_BASE = process.env.BACKEND_URL || "http://localhost:8000";

interface Property {
  id: string;
  name: string;
  slack_channel: string | null;
}

async function getProperty(id: string): Promise<Property | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/properties/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getMessages(propertyId: string): Promise<OwnerMessageOut[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/properties/${propertyId}/messages?limit=100`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getMessageWithAttachments(
  messageId: string
): Promise<MessageWithAttachments | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/messages/${messageId}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const result = await res.json();
    return {
      id: result.message_id,
      property_id: "", // filled by caller
      text: "", // filled by caller
      vision_text: null,
      agent_reply: result.agent_reply,
      agent_error: result.agent_error,
      dispatch_id: result.dispatch_id,
      latency_ms: null,
      created_at: result.created_at,
      attachments: result.attachments as AttachmentOut[],
    };
  } catch {
    return null;
  }
}

export default async function ConciergePage({
  params,
}: {
  params: { id: string };
}) {
  const property = await getProperty(params.id);
  if (!property) notFound();

  const messages = await getMessages(params.id);

  // Hydrate each message with its attachments (parallel fetch).
  // Reverse so oldest is at the top — chat order.
  const reversed = [...messages].reverse();
  const hydrated: MessageWithAttachments[] = await Promise.all(
    reversed.map(async (m) => {
      const detail = await getMessageWithAttachments(m.id);
      return {
        ...m,
        attachments: detail?.attachments ?? [],
      };
    })
  );

  return (
    <ConciergeChat
      propertyId={property.id}
      propertyName={property.name}
      initialMessages={hydrated}
    />
  );
}

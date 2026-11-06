// Mirrors approved bookings into the room's Microsoft 365 mailbox calendar
// (e.g. room_241500@utcc.ac.th) so the display outside the room shows them.
// Uses the app's own identity (client credentials), which needs the Graph
// application permission Calendars.ReadWrite with admin consent.

const GRAPH = "https://graph.microsoft.com/v1.0";

let cachedToken: { value: string; expiresAt: number } | null = null;

export function isRoomCalendarConfigured(): boolean {
  return !!(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET && process.env.AZURE_AD_TENANT_ID);
}

async function appToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const response = await fetch(
    `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.AZURE_AD_CLIENT_ID!,
        client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
        grant_type: "client_credentials",
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(`Graph token: ${data.error_description || data.error || response.status}`);

  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

async function graph(method: string, path: string, body?: unknown): Promise<Response> {
  const response = await fetch(`${GRAPH}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await appToken()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok && response.status !== 404) {
    const data = await response.json().catch(() => ({}));
    throw new Error(`Graph ${method} ${path}: ${response.status} ${data.error?.code || ""} ${data.error?.message || ""}`.trim());
  }
  return response;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Graph wants a local date-time plus a zone; send UTC so no conversion is needed.
const graphTime = (d: Date) => ({ dateTime: d.toISOString().replace("Z", ""), timeZone: "UTC" });

interface CalendarBooking {
  id: string;
  title: string;
  description?: string | null;
  attendees: number;
  startTime: Date;
  endTime: Date;
  user: { name: string; email: string };
  room: { name: string; code?: string | null };
}

/** Creates the event in the room mailbox and returns its Graph id. */
export async function createRoomEvent(mailbox: string, booking: CalendarBooking): Promise<string> {
  const lines = [
    `ผู้จอง: ${booking.user.name} (${booking.user.email})`,
    `จำนวนผู้เข้าร่วม: ${booking.attendees} คน`,
    booking.description ? `รายละเอียด: ${booking.description}` : "",
  ].filter(Boolean);

  const response = await graph("POST", `/users/${encodeURIComponent(mailbox)}/events`, {
    // Door displays usually show only the subject, so the booker's name goes there too.
    subject: `${booking.title} · ${booking.user.name}`,
    body: { contentType: "HTML", content: lines.map(escapeHtml).join("<br>") },
    start: graphTime(booking.startTime),
    end: graphTime(booking.endTime),
    location: { displayName: booking.room.code ? `${booking.room.code} (${booking.room.name})` : booking.room.name },
    showAs: "busy",
    isReminderOn: false,
    // Same booking never creates two events, even if approval is retried.
    transactionId: `meetingroom-${booking.id}`,
  });
  const event = await response.json();
  return event.id as string;
}

/** Removes the event; an already-deleted event counts as success. */
export async function deleteRoomEvent(mailbox: string, eventId: string): Promise<void> {
  await graph("DELETE", `/users/${encodeURIComponent(mailbox)}/events/${encodeURIComponent(eventId)}`);
}

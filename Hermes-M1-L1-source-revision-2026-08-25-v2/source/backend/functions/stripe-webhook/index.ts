type StripeEventEnvelope = {
  id?: unknown;
  type?: unknown;
  created?: unknown;
  livemode?: unknown;
  api_version?: unknown;
  data?: {
    object?: {
      id?: unknown;
    };
  };
};

const SIGNATURE_TOLERANCE_SECONDS = 300;
const encoder = new TextEncoder();

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}

function parseStripeSignature(header: string): { timestamp: number; signatures: string[] } | null {
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const component of header.split(",")) {
    const separator = component.indexOf("=");
    if (separator < 1) continue;
    const key = component.slice(0, separator).trim();
    const value = component.slice(separator + 1).trim();
    if (key === "t") timestamp = Number.parseInt(value, 10);
    if (key === "v1" && /^[a-f0-9]{64}$/i.test(value)) signatures.push(value.toLowerCase());
  }

  if (timestamp === null || !Number.isFinite(timestamp) || signatures.length === 0) return null;
  return { timestamp, signatures };
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;

  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (byte: number) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  webhookSecret: string,
): Promise<boolean> {
  const parsed = parseStripeSignature(signatureHeader);
  if (!parsed) return false;

  const currentTimestamp = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTimestamp - parsed.timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = await hmacSha256Hex(webhookSecret, `${parsed.timestamp}.${payload}`);
  return parsed.signatures.some((candidate: string) => constantTimeEqual(candidate, expected));
}

function parseEvent(payload: string): {
  eventId: string;
  eventType: string;
  objectId: string | null;
  createdAt: string;
  livemode: boolean;
  apiVersion: string | null;
} | null {
  let event: StripeEventEnvelope;
  try {
    event = JSON.parse(payload) as StripeEventEnvelope;
  } catch {
    return null;
  }

  if (
    typeof event.id !== "string" || !event.id.startsWith("evt_") ||
    typeof event.type !== "string" || event.type.length === 0 ||
    typeof event.created !== "number" || !Number.isFinite(event.created) ||
    typeof event.livemode !== "boolean"
  ) {
    return null;
  }

  const objectId = typeof event.data?.object?.id === "string" ? event.data.object.id : null;
  const apiVersion = typeof event.api_version === "string" ? event.api_version : null;
  return {
    eventId: event.id,
    eventType: event.type,
    objectId,
    createdAt: new Date(event.created * 1000).toISOString(),
    livemode: event.livemode,
    apiVersion,
  };
}

async function recordVerifiedEvent(event: ReturnType<typeof parseEvent>): Promise<boolean> {
  if (!event) return false;
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return false;

  const response = await fetch(`${supabaseUrl}/rest/v1/stripe_webhook_events?on_conflict=stripe_event_id`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify({
      stripe_event_id: event.eventId,
      event_type: event.eventType,
      object_id: event.objectId,
      stripe_created_at: event.createdAt,
      livemode: event.livemode,
      api_version: event.apiVersion,
      processing_status: "received",
    }),
  });

  return response.ok;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  if (!webhookSecret) return jsonResponse(503, { received: false, error: "Webhook is not configured" });

  const signatureHeader = request.headers.get("stripe-signature");
  if (!signatureHeader) return jsonResponse(400, { received: false, error: "Missing Stripe signature" });

  const payload = await request.text();
  if (!(await verifyStripeSignature(payload, signatureHeader, webhookSecret))) {
    return jsonResponse(400, { received: false, error: "Invalid Stripe signature" });
  }

  const event = parseEvent(payload);
  if (!event) return jsonResponse(400, { received: false, error: "Invalid Stripe event" });

  const recorded = await recordVerifiedEvent(event);
  if (!recorded) return jsonResponse(500, { received: false, error: "Event could not be recorded" });

  return jsonResponse(200, { received: true });
});

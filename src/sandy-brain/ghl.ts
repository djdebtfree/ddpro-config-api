import { config } from './config';
import { GhlContact } from './types';

const GHL_HEADERS = {
  Authorization: `Bearer ${config.GHL_PIT_TOKEN}`,
  Version: config.GHL_API_VERSION,
  'Content-Type': 'application/json',
};

async function parseResponseBody(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function getGhlContact(contactId: string): Promise<GhlContact | null> {
  const res = await fetch(`${config.GHL_API_BASE}/contacts/${contactId}`, { headers: GHL_HEADERS });
  if (!res.ok) {
    console.error(`GHL getContact failed (${res.status}): ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  return data.contact ?? data;
}

export async function sendGhlSms(contactId: string, message: string): Promise<string | null> {
  const res = await fetch(`${config.GHL_API_BASE}/conversations/messages`, {
    method: 'POST',
    headers: GHL_HEADERS,
    body: JSON.stringify({
      type: 'SMS',
      contactId,
      message,
    }),
  });

  if (!res.ok) {
    const body = await parseResponseBody(res);
    console.error(`GHL sendSms failed (${res.status}):`, body);
    throw new Error(`GHL send SMS failed with ${res.status}`);
  }

  const data = await res.json();
  return data.messageId ?? data.id ?? null;
}

export async function updateGhlContact(contactId: string, payload: Partial<GhlContact>): Promise<GhlContact | null> {
  const res = await fetch(`${config.GHL_API_BASE}/contacts/${contactId}`, {
    method: 'PUT',
    headers: GHL_HEADERS,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await parseResponseBody(res);
    console.error(`GHL updateGhlContact failed (${res.status}):`, body);
    throw new Error(`GHL contact update failed with ${res.status}`);
  }

  return parseResponseBody(res);
}

export async function lookupContactByPhone(phone: string): Promise<GhlContact | null> {
  if (!config.GHL_LOCATION_ID) {
    console.warn('GHL_LOCATION_ID not set, cannot lookup contact by phone.');
    return null;
  }
  const res = await fetch(
    `${config.GHL_API_BASE}/contacts/?locationId=${config.GHL_LOCATION_ID}&query=${encodeURIComponent(phone)}&limit=1`,
    { headers: GHL_HEADERS }
  );

  if (!res.ok) {
    console.error(`GHL lookupContactByPhone failed (${res.status}): ${await res.text()}`);
    return null;
  }

  const data = await res.json();
  const contacts = data.contacts ?? [];
  return contacts.length > 0 ? contacts[0] : null;
}

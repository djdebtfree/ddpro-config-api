export interface CogneeMemoryRecord {
  text: string;
  metadata?: Record<string, unknown>;
}

export interface CogneeSearchResult {
  id?: string;
  text?: string;
  content?: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

export class CogneeClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.apiKey = apiKey;
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}`, 'x-api-key': this.apiKey } : {}),
    };
  }

  async search(query: string, options: { dataset?: string; limit?: number; filters?: Record<string, unknown> } = {}): Promise<CogneeSearchResult[]> {
    if (!query || !query.trim()) {
      return [];
    }

    const response = await fetch(`${this.baseUrl}/api/v1/search`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        query,
        dataset: options.dataset,
        limit: options.limit ?? 8,
        filters: options.filters ?? {},
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Cognee search failed (${response.status}): ${body}`);
    }

    const payload = await response.json();
    if (Array.isArray(payload)) {
      return payload;
    }
    if (Array.isArray(payload?.results)) {
      return payload.results;
    }
    if (Array.isArray(payload?.data)) {
      return payload.data;
    }
    return [];
  }

  async cognify(record: CogneeMemoryRecord, options: { dataset?: string } = {}): Promise<unknown> {
    if (!record.text || !record.text.trim()) {
      return null;
    }

    const response = await fetch(`${this.baseUrl}/api/v1/cognify`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        text: record.text,
        dataset: options.dataset,
        metadata: record.metadata ?? {},
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Cognee cognify failed (${response.status}): ${body}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  }
}

export function buildCogneeIdentityQuery(input: {
  contactId?: string;
  phone?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}): string {
  const parts = [
    input.contactId && `contact:${input.contactId}`,
    input.phone && `phone:${input.phone}`,
    input.email && `email:${input.email}`,
    (input.firstName || input.lastName) && `name:${[input.firstName, input.lastName].filter(Boolean).join(' ')}`,
  ].filter(Boolean);

  return parts.join(' | ');
}

export function formatCogneeMemoryContext(results: CogneeSearchResult[]): string {
  if (!results.length) {
    return '';
  }

  return results
    .slice(0, 8)
    .map((result, index) => {
      const text = result.text || result.content || '';
      const score = typeof result.score === 'number' ? ` score=${result.score.toFixed(3)}` : '';
      return `[Memory ${index + 1}${score}] ${text}`.trim();
    })
    .filter(Boolean)
    .join('\n');
}

export function buildInteractionMemoryRecord(input: {
  dataset: string;
  channel: string;
  contactId?: string;
  phone?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  inboundMessage?: string;
  outboundMessage?: string | null;
  learnedFacts?: string[];
  role?: string;
  state?: string;
  tags?: string[];
  eventType?: string;
}): CogneeMemoryRecord {
  const lines = [
    `dataset=${input.dataset}`,
    `channel=${input.channel}`,
    input.contactId ? `contact_id=${input.contactId}` : null,
    input.phone ? `phone=${input.phone}` : null,
    input.email ? `email=${input.email}` : null,
    input.firstName || input.lastName ? `name=${[input.firstName, input.lastName].filter(Boolean).join(' ')}` : null,
    input.role ? `role=${input.role}` : null,
    input.state ? `state=${input.state}` : null,
    input.tags?.length ? `tags=${input.tags.join(',')}` : null,
    input.eventType ? `event_type=${input.eventType}` : null,
    input.inboundMessage ? `contact_said=${input.inboundMessage}` : null,
    input.outboundMessage ? `sandy_said=${input.outboundMessage}` : null,
    input.learnedFacts?.length ? `learned_facts=${input.learnedFacts.join(' | ')}` : null,
    `timestamp=${new Date().toISOString()}`,
  ].filter(Boolean);

  return {
    text: lines.join('\n'),
    metadata: {
      dataset: input.dataset,
      channel: input.channel,
      contactId: input.contactId,
      phone: input.phone,
      email: input.email,
      role: input.role,
      state: input.state,
      tags: input.tags,
      eventType: input.eventType,
      learnedFacts: input.learnedFacts ?? [],
      createdAt: new Date().toISOString(),
    },
  };
}

export function buildCogneeDataset(locationId?: string): string {
  return `sandy-brain-${locationId || 'global'}`;
}

export function createCogneeClientFromEnv(env: { COGNEE_API_URL?: string; COGNEE_API_KEY?: string }): CogneeClient | null {
  if (!env.COGNEE_API_URL) {
    return null;
  }
  return new CogneeClient(env.COGNEE_API_URL, env.COGNEE_API_KEY);
}

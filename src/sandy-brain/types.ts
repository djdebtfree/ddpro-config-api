export type ContactRole =
  | 'owner'
  | 'admin'
  | 'internal'
  | 'customer'
  | 'prospect'
  | 'unknown';

export interface GhlContact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  customFields?: Record<string, string>;
  state?: string;
  // Add other relevant GHL contact fields as needed
}

export interface SandyBrainContact extends GhlContact {
  role: ContactRole;
  isOwner: boolean;
  isAdmin: boolean;
  isInternal: boolean;
  isCustomer: boolean;
  isProspect: boolean;
}

export type ChannelType = 'sms' | 'email' | 'vapi' | 'liveavatar' | 'webhook' | 'form';

export type MessageType =
  | 'prospect-followup'
  | 'appointment-confirmation'
  | 'post-meeting'
  | 'recovery'
  | 'clean-exit'
  | 'install-welcome'
  | 'purchase-thank-you'
  | 'inbound-reply'
  | 'audit-report';

export interface ConversationEntry {
  id?: string;
  contact_id: string; // Normalized contact identifier (e.g., phone number or email)
  client_id: string | null; // DataDriverPro client ID (Supabase client.id)
  ghl_contact_id: string | null; // GHL contact ID
  channel: ChannelType;
  role: 'sandy' | 'contact';
  message: string;
  sentiment: string | null;
  key_facts: string[];
  created_at?: string;
}

export interface SandyBrainInput {
  channel: ChannelType;
  inboundMessage?: string; // For SMS, email, VAPI, form submissions
  contactId?: string; // GHL contact ID
  phone?: string; // Contact phone number
  email?: string; // Contact email
  locationId?: string; // GHL location ID
  eventType?: string; // e.g., 'install', 'purchase', 'pipeline_stage_change'
  messageType?: MessageType; // Normalized message intent from the channel wrapper
  eventData?: Record<string, any>; // Additional data from the event
  auditedUrl?: string; // For audit-related events
}

export interface SandyBrainOutput {
  response: string | null;
  action: 'send_message' | 'log_only' | 'no_action' | 'update_contact';
  messageType?: MessageType;
  contactUpdate?: Partial<GhlContact>;
  logReason?: string;
  suppressed?: boolean;
  frustrationDetected?: boolean;
  retryLimitReached?: boolean;
  // Add other relevant output fields
}

export interface SandyBrainContext {
  contact: SandyBrainContact;
  conversationHistory: ConversationEntry[];
  knowledgeContext: string; // Context from knowledge base
  pipelineState: string; // Inferred pipeline state from GHL tags
  // Add other relevant context fields
}

export interface SandyBrainConfig {
  OWNER_PHONES: string[];
  OWNER_EMAILS: string[];
  INTERNAL_DOMAINS: string[];
  GHL_API_BASE: string;
  GHL_API_VERSION: string;
  GHL_PIT_TOKEN: string;
  GHL_LOCATION_ID: string;
  SUPABASE_CLIENTS_URL: string;
  SUPABASE_CLIENTS_SERVICE_KEY: string;
  SUPABASE_DATA_URL: string;
  SUPABASE_DATA_SERVICE_KEY: string;
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  COGNEE_API_URL: string;
  COGNEE_API_KEY: string;
  QCLAW_WEBHOOK_URL: string;
  // Add other relevant configuration
}

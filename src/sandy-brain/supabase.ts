import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './config';
import { ConversationEntry } from './types';

let clientsDb: SupabaseClient | null = null;
let dataDb: SupabaseClient | null = null;

export function getClientsDb(): SupabaseClient {
  if (!clientsDb) {
    clientsDb = createClient(
      config.SUPABASE_CLIENTS_URL,
      config.SUPABASE_CLIENTS_SERVICE_KEY
    );
  }
  return clientsDb;
}

export function getDataDb(): SupabaseClient {
  if (!dataDb) {
    dataDb = createClient(
      config.SUPABASE_DATA_URL,
      config.SUPABASE_DATA_SERVICE_KEY
    );
  }
  return dataDb;
}

export async function readConversationHistory(contactId: string, limit: number = 10): Promise<ConversationEntry[]> {
  const db = getClientsDb();
  const { data, error } = await db
    .from('sandy_conversations')
    .select('id, contact_id, client_id, ghl_contact_id, channel, role, message, sentiment, key_facts, created_at')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 100));

  if (error) {
    console.error('Error reading conversation history:', error);
    throw error;
  }

  return data || [];
}

export async function writeConversationEntry(entry: Omit<ConversationEntry, 'id' | 'created_at'>): Promise<void> {
  const db = getClientsDb();
  const { error } = await db
    .from('sandy_conversations')
    .insert({
      contact_id: entry.contact_id,
      client_id: entry.client_id,
      ghl_contact_id: entry.ghl_contact_id,
      channel: entry.channel,
      role: entry.role,
      message: entry.message,
      sentiment: entry.sentiment,
      key_facts: entry.key_facts || [],
    });

  if (error) {
    console.error('Error writing conversation entry:', error);
    throw error;
  }
}

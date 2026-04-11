import dotenv from 'dotenv';
dotenv.config();

import { SandyBrainConfig } from './types';

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config: SandyBrainConfig = {
  OWNER_PHONES: process.env.OWNER_PHONES ? process.env.OWNER_PHONES.split(',') : [],
  OWNER_EMAILS: process.env.OWNER_EMAILS ? process.env.OWNER_EMAILS.split(',') : [],
  INTERNAL_DOMAINS: process.env.INTERNAL_DOMAINS ? process.env.INTERNAL_DOMAINS.split(',') : [],
  GHL_API_BASE: process.env.GHL_API_BASE || 'https://services.leadconnectorhq.com',
  GHL_API_VERSION: process.env.GHL_API_VERSION || '2021-07-28',
  GHL_PIT_TOKEN: getRequiredEnv('GHL_PIT_TOKEN'),
  GHL_LOCATION_ID: process.env.GHL_LOCATION_ID || '', // Optional for some GHL API calls
  SUPABASE_CLIENTS_URL: getRequiredEnv('SUPABASE_CLIENTS_URL'),
  SUPABASE_CLIENTS_SERVICE_KEY: getRequiredEnv('SUPABASE_CLIENTS_SERVICE_KEY'),
  SUPABASE_DATA_URL: process.env.SUPABASE_DATA_URL || 'https://smfgkhlwoszldfsxkvib.supabase.co',
  SUPABASE_DATA_SERVICE_KEY: getRequiredEnv('SUPABASE_DATA_SERVICE_KEY'),
  ANTHROPIC_API_KEY: getRequiredEnv('ANTHROPIC_API_KEY'),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '', // Optional for knowledge context
  COGNEE_API_URL: process.env.COGNEE_API_URL || '',
  COGNEE_API_KEY: process.env.COGNEE_API_KEY || '',
  QCLAW_WEBHOOK_URL: process.env.QCLAW_WEBHOOK_URL || '', // Optional for notifications
};

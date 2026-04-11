import Anthropic from '@anthropic-ai/sdk';
import { config } from './config';
import { getGhlContact, sendGhlSms, updateGhlContact, lookupContactByPhone } from './ghl';
import { readConversationHistory, writeConversationEntry } from './supabase';
import { buildSandyKnowledgeContext } from './sandy-context';
import { resolveContactRole, isInternalDomain } from './identity';
import {
  buildCogneeDataset,
  buildCogneeIdentityQuery,
  buildInteractionMemoryRecord,
  createCogneeClientFromEnv,
  formatCogneeMemoryContext,
} from './cognee-client';
import { SandyBrainInput, SandyBrainOutput, SandyBrainContact, ConversationEntry, MessageType } from './types';

const anthropic = new Anthropic({
  apiKey: config.ANTHROPIC_API_KEY,
});

const cognee = createCogneeClientFromEnv({
  COGNEE_API_URL: config.COGNEE_API_URL,
  COGNEE_API_KEY: config.COGNEE_API_KEY,
});

const SANDY_SYSTEM_PROMPT = `You are Sandy Beach, the single channel-agnostic AI brain for Data Driver.
You remember people across SMS, email, voice, avatar, and web channels.
You are warm, sharp, direct, and human.

Rules:
- Keep replies concise and channel-friendly.
- Never behave like a cold outbound bot when the person is already known.
- Respect role and context. Owners, admins, and internal people must never be prospected.
- If the person is frustrated, confused, or stuck in a loop, acknowledge it and fix the issue directly.
- If data already exists, do not ask for it again.
- Use memory, conversation history, and CRM context together.
- Do not invent facts that are not present in the supplied context.`;

const MESSAGE_TYPE_PROMPTS: Record<MessageType, string> = {
  'prospect-followup': 'Write a natural follow-up message to a prospect. Keep it concise and low pressure. Suggest a small next step.',
  'appointment-confirmation': 'Write a short appointment confirmation or reminder. Be clear and calm.',
  'post-meeting': 'Write a short follow-up after a meeting. Ask what stood out and offer the next step without pressure.',
  'recovery': 'Write a re-engagement message for someone who went quiet. Be respectful and direct.',
  'clean-exit': 'Write a respectful closeout message that leaves the door open and confirms no pressure.',
  'install-welcome': 'Write a welcome message for a new install. Offer help and a simple next step.',
  'purchase-thank-you': 'Write a concise thank-you message for a new purchase or upgrade.',
  'inbound-reply': 'Reply naturally to the latest inbound message using the available memory and CRM context.',
  'audit-report': 'Write a concise audit summary with the key issue and the safest next step.',
};

function notifyQclaw(message: string) {
  if (config.QCLAW_WEBHOOK_URL) {
    console.log(`QCLAW: ${message}`);
  }
}

function inferMessageType(input: SandyBrainInput): MessageType {
  if (input.eventType === 'audit-report') {
    return 'audit-report';
  }
  return input.messageType || 'inbound-reply';
}

function summarizeConversation(history: ConversationEntry[]): string {
  if (!history.length) {
    return '';
  }

  return history
    .slice(0, 6)
    .reverse()
    .map((entry) => `${entry.role === 'sandy' ? 'Sandy' : 'Contact'} (${entry.channel}): ${entry.message}`)
    .join('\n');
}

function hasValidState(state?: string): boolean {
  if (!state) return false;
  const normalized = state.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) && normalized !== 'YO';
}

function buildKnownDataFacts(contact: SandyBrainContact): string[] {
  const facts: string[] = [];
  if (contact.email) facts.push(`known_email=${contact.email}`);
  if (hasValidState(contact.state)) facts.push(`known_state=${contact.state}`);
  if (contact.firstName || contact.lastName) facts.push(`known_name=${[contact.firstName, contact.lastName].filter(Boolean).join(' ')}`);
  if (contact.tags?.length) facts.push(`known_tags=${contact.tags.join(',')}`);
  return facts;
}

function detectFrustration(inboundMessage?: string, conversationHistory: ConversationEntry[] = []): boolean {
  const text = (inboundMessage || '').toLowerCase();
  const frustrationSignals = [
    'stop asking',
    'already told',
    'you already have',
    'why are you asking',
    'this is wrong',
    'loop',
    'frustrating',
    'annoying',
    'not a lead',
    'i am the owner',
    'internal',
  ];

  const repeatedPrompts = conversationHistory
    .filter((entry) => entry.role === 'sandy')
    .slice(0, 4)
    .map((entry) => entry.message.toLowerCase())
    .filter((message) => message.includes('email') || message.includes('state')).length;

  return frustrationSignals.some((signal) => text.includes(signal)) || repeatedPrompts >= 2;
}

function retryLimitReached(conversationHistory: ConversationEntry[] = []): boolean {
  const recentOutbound = conversationHistory.filter((entry) => entry.role === 'sandy').slice(0, 4);
  return recentOutbound.length >= 3;
}

async function generateSandyMessage(args: {
  messageType: MessageType;
  contact: SandyBrainContact;
  input: SandyBrainInput;
  conversationHistory: ConversationEntry[];
  knowledgeContext: string;
  cogneeContext: string;
  frustrationDetected: boolean;
}): Promise<string> {
  const { messageType, contact, input, conversationHistory, knowledgeContext, cogneeContext, frustrationDetected } = args;
  const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'there';

  const promptSections = [
    `Message type: ${messageType}`,
    `Contact role: ${contact.role}`,
    `Contact name: ${contactName}`,
    contact.email ? `Email on file: ${contact.email}` : null,
    contact.phone ? `Phone on file: ${contact.phone}` : null,
    hasValidState(contact.state) ? `State on file: ${contact.state}` : 'State on file: missing or invalid',
    contact.tags?.length ? `Tags: ${contact.tags.join(', ')}` : null,
    input.inboundMessage ? `Latest inbound message: ${input.inboundMessage}` : null,
    input.eventType ? `Event type: ${input.eventType}` : null,
    input.eventData ? `Event data: ${JSON.stringify(input.eventData)}` : null,
    frustrationDetected ? 'Important: frustration has been detected. Acknowledge the issue and avoid repeating requests.' : null,
    buildKnownDataFacts(contact).length ? `Known data: ${buildKnownDataFacts(contact).join(' | ')}` : null,
    conversationHistory.length ? `Recent conversation history:\n${summarizeConversation(conversationHistory)}` : null,
    cogneeContext ? `Cognee memory context:\n${cogneeContext}` : null,
    knowledgeContext ? `Knowledge context:\n${knowledgeContext}` : null,
    `Instruction: ${MESSAGE_TYPE_PROMPTS[messageType]}`,
  ].filter(Boolean);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 220,
    system: SANDY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: promptSections.join('\n\n') }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text returned from Anthropic.');
  }

  return textBlock.text.trim().replace(/^"|"$/g, '');
}

export async function processSandyBrain(input: SandyBrainInput): Promise<SandyBrainOutput> {
  let rawContact = input.contactId ? await getGhlContact(input.contactId) : null;

  if (!rawContact && input.phone) {
    rawContact = await lookupContactByPhone(input.phone);
  }

  if (!rawContact) {
    return {
      response: null,
      action: 'no_action',
      logReason: 'Contact not found in GHL',
    };
  }

  const contact: SandyBrainContact = resolveContactRole(rawContact);
  const ghlContactId = rawContact.id;
  const dataset = buildCogneeDataset(input.locationId || input.eventData?.locationId as string | undefined);

  let cogneeContext = '';
  try {
    if (cognee) {
      const memoryResults = await cognee.search(
        buildCogneeIdentityQuery({
          contactId: ghlContactId,
          phone: contact.phone,
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
        }),
        { dataset, limit: 8 },
      );
      cogneeContext = formatCogneeMemoryContext(memoryResults);
    }
  } catch (error) {
    console.warn('Cognee search failed:', error instanceof Error ? error.message : error);
  }

  const messageType = inferMessageType(input);
  const outboundLikeEvent = messageType !== 'inbound-reply';

  if (outboundLikeEvent && (contact.isOwner || contact.isInternal || contact.isAdmin)) {
    const reason = `Suppressed for ${contact.role}`;
    notifyQclaw(`Sandy Brain suppression: ${reason} for ${contact.email || contact.phone || ghlContactId}`);
    return {
      response: null,
      action: 'log_only',
      messageType,
      logReason: reason,
      suppressed: true,
    };
  }

  if (input.auditedUrl) {
    try {
      const hostname = new URL(input.auditedUrl).hostname;
      if (isInternalDomain(`audit@${hostname}`)) {
        return {
          response: null,
          action: 'log_only',
          messageType,
          logReason: 'Suppressed for internal domain',
          suppressed: true,
        };
      }
    } catch {
      if (isInternalDomain(`audit@${input.auditedUrl.replace(/^https?:\/\//, '').split('/')[0]}`)) {
        return {
          response: null,
          action: 'log_only',
          messageType,
          logReason: 'Suppressed for internal domain',
          suppressed: true,
        };
      }
    }
  }

  const conversationHistory = await readConversationHistory(ghlContactId, 12).catch(() => []);
  const knowledgeContextResult = await buildSandyKnowledgeContext({
    queryText: input.inboundMessage || input.eventType || contact.email || contact.phone || ghlContactId,
    tenantScope: input.locationId || contact.customFields?.dd_ghl_location_id || 'global',
  }).catch(() => ({ contextText: '', matches: [] }));

  const frustrationDetected = detectFrustration(input.inboundMessage, conversationHistory);
  const limitReached = outboundLikeEvent && retryLimitReached(conversationHistory);

  if (limitReached) {
    return {
      response: null,
      action: 'log_only',
      messageType,
      logReason: 'Retry limit reached',
      retryLimitReached: true,
      suppressed: true,
    };
  }

  const inboundLower = (input.inboundMessage || '').toLowerCase();
  const optedOut = ['stop', 'unsubscribe', 'cancel', 'quit', 'leave me alone'].some((token) => inboundLower.includes(token));

  if (optedOut) {
    const optOutMessage = 'Understood. I have marked this conversation as opted out and will not send further follow-up.';
    const nextTags = Array.from(new Set([...(contact.tags || []), 'do-not-prospect', 'sandy-opt-out']));

    await updateGhlContact(ghlContactId, { tags: nextTags });
    await writeConversationEntry({
      contact_id: ghlContactId,
      client_id: null,
      ghl_contact_id: ghlContactId,
      channel: input.channel,
      role: 'contact',
      message: input.inboundMessage || '',
      sentiment: 'negative',
      key_facts: ['opt-out'],
    });
    await writeConversationEntry({
      contact_id: ghlContactId,
      client_id: null,
      ghl_contact_id: ghlContactId,
      channel: input.channel,
      role: 'sandy',
      message: optOutMessage,
      sentiment: 'neutral',
      key_facts: ['opt-out-confirmed'],
    });

    try {
      if (cognee) {
        await cognee.cognify(
          buildInteractionMemoryRecord({
            dataset,
            channel: input.channel,
            contactId: ghlContactId,
            phone: contact.phone,
            email: contact.email,
            firstName: contact.firstName,
            lastName: contact.lastName,
            inboundMessage: input.inboundMessage,
            outboundMessage: optOutMessage,
            learnedFacts: ['opt-out', 'do-not-prospect'],
            role: contact.role,
            state: contact.state,
            tags: nextTags,
            eventType: input.eventType,
          }),
          { dataset },
        );
      }
    } catch (error) {
      console.warn('Cognee write failed during opt-out:', error instanceof Error ? error.message : error);
    }

    return {
      response: optOutMessage,
      action: 'send_message',
      messageType: 'clean-exit',
      contactUpdate: { tags: nextTags },
      frustrationDetected,
    };
  }

  const sandyResponse = await generateSandyMessage({
    messageType,
    contact,
    input,
    conversationHistory,
    knowledgeContext: knowledgeContextResult.contextText || '',
    cogneeContext,
    frustrationDetected,
  });

  if (input.inboundMessage) {
    await writeConversationEntry({
      contact_id: ghlContactId,
      client_id: null,
      ghl_contact_id: ghlContactId,
      channel: input.channel,
      role: 'contact',
      message: input.inboundMessage,
      sentiment: frustrationDetected ? 'negative' : 'unknown',
      key_facts: buildKnownDataFacts(contact),
    });
  }

  await writeConversationEntry({
    contact_id: ghlContactId,
    client_id: null,
    ghl_contact_id: ghlContactId,
    channel: input.channel,
    role: 'sandy',
    message: sandyResponse,
    sentiment: frustrationDetected ? 'repair' : 'unknown',
    key_facts: buildKnownDataFacts(contact),
  });

  const nextTags = Array.from(new Set([...(contact.tags || []), 'sandy-engaged']));
  const nextCustomFields = {
    ...(contact.customFields || {}),
    dd_last_contacted: new Date().toISOString(),
    dd_sandy_conversation_count: String((((contact.customFields?.dd_sandy_conversation_count && parseInt(contact.customFields.dd_sandy_conversation_count, 10)) || 0) + 1)),
  };

  await updateGhlContact(ghlContactId, {
    tags: nextTags,
    customFields: nextCustomFields,
  });

  try {
    if (cognee) {
      await cognee.cognify(
        buildInteractionMemoryRecord({
          dataset,
          channel: input.channel,
          contactId: ghlContactId,
          phone: contact.phone,
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
          inboundMessage: input.inboundMessage,
          outboundMessage: sandyResponse,
          learnedFacts: buildKnownDataFacts(contact),
          role: contact.role,
          state: contact.state,
          tags: nextTags,
          eventType: input.eventType,
        }),
        { dataset },
      );
    }
  } catch (error) {
    console.warn('Cognee write failed:', error instanceof Error ? error.message : error);
  }

  if (input.channel === 'sms' && input.messageType === 'inbound-reply') {
    await sendGhlSms(ghlContactId, sandyResponse);
  }

  return {
    response: sandyResponse,
    action: 'send_message',
    messageType,
    contactUpdate: {
      tags: nextTags,
      customFields: nextCustomFields,
    },
    frustrationDetected,
    retryLimitReached: false,
  };
}

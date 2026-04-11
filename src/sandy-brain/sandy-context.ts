import { config } from './config';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});

// Placeholder for actual knowledge chunk search. In a real scenario, this would query a vector DB.
// For now, it will return a dummy context.
async function searchKnowledgeChunks(queryEmbedding: number[], tenantScope: string, limit: number = 4): Promise<any[]> {
  console.warn('Knowledge chunk search is a placeholder. Implement actual vector DB search.');
  // In a real implementation, this would query a vector database (e.g., Supabase vector, Pinecone, Weaviate)
  // with the queryEmbedding to find relevant knowledge chunks.
  // For demonstration, returning a dummy result.
  if (queryEmbedding.length > 0) {
    return [
      { content: 'Data Driver is a marketing analytics platform that connects ad spend to revenue.', source: 'internal' },
      { content: 'Users install Data Driver via the GHL marketplace and can upgrade to paid tiers.', source: 'internal' },
    ];
  }
  return [];
}

export async function buildSandyKnowledgeContext({
  queryText,
  lane = 'buyer',
  tenantScope = 'global',
  limit = 4,
}: {
  queryText: string;
  lane?: string;
  tenantScope?: string;
  limit?: number;
}): Promise<{ matches: any[]; contextText: string }> {
  if (!config.OPENAI_API_KEY || !queryText) {
    return { matches: [], contextText: '' };
  }

  try {
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: queryText,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;
    const matches = await searchKnowledgeChunks(queryEmbedding, tenantScope, limit);

    const contextText = matches.map((match, i) => `[${i + 1}] ${match.content}`).join('\n');

    return { matches, contextText };
  } catch (err) {
    console.error('Error building Sandy knowledge context:', err);
    return { matches: [], contextText: '' };
  }
}

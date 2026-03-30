/**
 * core/memory.js — Three-tier memory manager
 *
 * Tier 1: Short-term  — current session, in-request only (no setup needed)
 * Tier 2: Long-term   — persists across sessions per user (requires Supabase)
 * Tier 3: Knowledge   — semantic search over uploaded docs (requires Supabase + pgvector)
 *
 * All tiers are disabled by default. Enable in agent.config.js → memory.
 *
 * @module core/memory
 */

import { serverEnv } from "@/lib/env.js";
import { getSupabaseAdmin } from "@/lib/supabase.js";
import agentConfig from "@/agent.config.js";

// ─── Long-term memory ─────────────────────────────────────────────────────────

/**
 * Store a fact in long-term memory with a vector embedding.
 *
 * @param {string} userId
 * @param {string} content
 * @param {Object} [metadata]
 * @returns {Promise<import('@/core/types.js').MemoryEntry | null>}
 */
export async function rememberFact(userId, content, metadata = {}) {
  if (!agentConfig.memory.longTerm) {
    return null;
  }

  const supabase = await getSupabaseAdmin();
  const embedding = await generateEmbedding(content);

  const { data, error } = await supabase
    .from("agent_memories")
    .insert({
      user_id: userId,
      content,
      metadata,
      embedding,
      tier: "long_term",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to store memory: ${error.message}`);
  }

  return {
    id: data.id,
    content: data.content,
    tier: "long_term",
    metadata: data.metadata,
    createdAt: new Date(data.created_at),
  };
}

/**
 * Recall memories semantically relevant to the query.
 *
 * @param {string} userId
 * @param {string} query
 * @param {number} [limit=5]
 * @returns {Promise<import('@/core/types.js').MemoryEntry[]>}
 */
export async function recallMemories(userId, query, limit = 5) {
  if (!agentConfig.memory.longTerm) {
    return [];
  }

  const supabase = await getSupabaseAdmin();
  const embedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc("match_memories", {
    query_embedding: embedding,
    match_user_id: userId,
    match_count: limit,
    match_threshold: 0.7,
  });

  if (error) {
    console.error("[memory] recall failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    content: row.content,
    tier: "long_term",
    metadata: row.metadata ?? {},
    score: row.similarity,
    createdAt: new Date(row.created_at),
  }));
}

// ─── Knowledge base (RAG) ─────────────────────────────────────────────────────

/**
 * Semantic search over the agent's knowledge base.
 *
 * @param {string} query
 * @param {number} [limit=4]
 * @returns {Promise<Array<{ content: string, source: string, score: number }>>}
 */
export async function searchKnowledgeBase(query, limit = 4) {
  if (!agentConfig.memory.knowledgeBase) {
    return [];
  }

  const supabase = await getSupabaseAdmin();
  const embedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc("match_knowledge", {
    query_embedding: embedding,
    match_count: limit,
    match_threshold: 0.65,
  });

  if (error) {
    console.error("[memory] knowledge search failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    content: row.content,
    source: row.source ?? "knowledge base",
    score: row.similarity,
  }));
}

// ─── Context builder ──────────────────────────────────────────────────────────

/**
 * Build a memory context string to inject into the system prompt.
 * Returns an empty string when memory is disabled — no overhead.
 *
 * @param {string} userId
 * @param {string} query  — the user's current message
 * @returns {Promise<string>}
 */
export async function buildMemoryContext(userId, query) {
  const parts = [];

  if (agentConfig.memory.longTerm) {
    const memories = await recallMemories(userId, query);
    if (memories.length > 0) {
      parts.push(
        "## What I know about this user:\n" +
          memories.map((m) => `- ${m.content}`).join("\n")
      );
    }
  }

  if (agentConfig.memory.knowledgeBase) {
    const chunks = await searchKnowledgeBase(query);
    if (chunks.length > 0) {
      parts.push(
        "## Relevant information from the knowledge base:\n" +
          chunks.map((c) => `[${c.source}]\n${c.content}`).join("\n\n")
      );
    }
  }

  return parts.join("\n\n");
}

// ─── Embedding ────────────────────────────────────────────────────────────────

/**
 * Generate a vector embedding for semantic search.
 * Uses Google's free text-embedding-004 model.
 *
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function generateEmbedding(text) {
  const { embed } = await import("ai");
  const { createGoogleGenerativeAI } = await import("@ai-sdk/google");

  const google = createGoogleGenerativeAI({
    apiKey: serverEnv.GOOGLE_GENERATIVE_AI_API_KEY,
  });

  const { embedding } = await embed({
    model: google.textEmbeddingModel("text-embedding-004"),
    value: text,
  });

  return embedding;
}
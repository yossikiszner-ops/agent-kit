/**
 * app/api/knowledge/route.js — Knowledge base document upload
 *
 * POST /api/knowledge — Upload a document to the knowledge base
 * Body: { content: string, source?: string, chunkSize?: number }
 *
 * The content is split into overlapping chunks, embedded, and stored
 * in Supabase for semantic retrieval by the knowledge-base brick.
 *
 * Requires: Supabase with pgvector
 */

import { NextResponse } from "next/server";
import * as z from "zod";
import { serverEnv } from "@/lib/env.js";
import { getSupabaseAdmin } from "@/lib/supabase.js";

const UploadSchema = z.object({
  content: z
    .string()
    .min(50)
    .max(500_000)
    .describe("Document text content"),
  source: z
    .string()
    .max(200)
    .optional()
    .describe("Document title or URL for citation"),
  chunkSize: z
    .number()
    .int()
    .min(100)
    .max(2000)
    .optional()
    .default(500)
    .describe("Characters per chunk (default 500)"),
  chunkOverlap: z
    .number()
    .int()
    .min(0)
    .max(500)
    .optional()
    .default(50)
    .describe("Overlap between chunks (default 50)"),
});

export async function POST(request) {
  if (!serverEnv.SUPABASE_URL || !serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error:
          "Knowledge base requires Supabase. " +
          "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
      },
      { status: 400 }
    );
  }

  let raw;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UploadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { content, source, chunkSize, chunkOverlap } = parsed.data;

  try {
    // Split into overlapping chunks
    const chunks = chunkText(content, chunkSize, chunkOverlap);

    // Embed all chunks in parallel (batched to avoid rate limits)
    const BATCH_SIZE = 5;
    const embedded = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchEmbeddings = await Promise.all(
        batch.map((chunk) => embedText(chunk))
      );
      for (let j = 0; j < batch.length; j++) {
        embedded.push({ content: batch[j], embedding: batchEmbeddings[j] });
      }
    }

    // Store in Supabase
    const supabase = await getSupabaseAdmin();

    const rows = embedded.map((e) => ({
      content: e.content,
      source: source ?? "uploaded document",
      embedding: e.embedding,
    }));

    const { error } = await supabase.from("agent_knowledge").insert(rows);
    if (error) {
      throw new Error(`Supabase insert failed: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      chunksStored: rows.length,
      source: source ?? "uploaded document",
      totalCharacters: content.length,
    });
  } catch (err) {
    console.error("[/api/knowledge]", err);
    return NextResponse.json(
      {
        error: "Failed to process document",
        message:
          process.env.NODE_ENV === "development"
            ? err.message
            : "Internal error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  if (!serverEnv.SUPABASE_URL) {
    return NextResponse.json({ count: 0, message: "Supabase not configured" });
  }

  try {
    const supabase = await getSupabaseAdmin();

    const { count } = await supabase
      .from("agent_knowledge")
      .select("*", { count: "exact", head: true });

    const { data: sources } = await supabase
      .from("agent_knowledge")
      .select("source")
      .order("source");

    const uniqueSources = [...new Set((sources ?? []).map((r) => r.source))];

    return NextResponse.json({
      count: count ?? 0,
      sources: uniqueSources,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Split text into overlapping chunks.
 * @param {string} text
 * @param {number} size
 * @param {number} overlap
 * @returns {string[]}
 */
function chunkText(text, size = 500, overlap = 50) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 20) {
      chunks.push(chunk);
    }
    start += size - overlap;
  }

  return chunks;
}

/**
 * Generate a vector embedding for a text chunk.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedText(text) {
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

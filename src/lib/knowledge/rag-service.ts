/**
 * RAG (Retrieval-Augmented Generation) Service
 *
 * Provides semantic search over knowledge base using vector embeddings.
 * Supports multiple retrieval strategies and reranking.
 */

import { db } from "@/lib/db";
import { knowledgeChunks, knowledgeSources, faqItems } from "@/lib/db/schema/knowledge";
import { eq, and, sql, isNull } from "drizzle-orm";
import { getEmbeddingService, EmbeddingService } from "./embedding-service";

// Types
export interface SearchOptions {
  limit?: number;
  minScore?: number;
  sources?: string[]; // Filter by source IDs
  includeMetadata?: boolean;
  searchFaqs?: boolean;
  rerank?: boolean;
}

export interface SearchResult {
  content: string;
  score: number;
  sourceId: string;
  sourceName?: string;
  sourceType?: string;
  chunkIndex?: number;
  metadata?: Record<string, unknown>;
}

export interface FaqSearchResult {
  question: string;
  answer: string;
  score: number;
  category?: string | null;
  id: string;
}

export interface RagContext {
  chunks: SearchResult[];
  faqs: FaqSearchResult[];
  totalResults: number;
  searchTimeMs: number;
}

// Default options
const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  limit: 5,
  minScore: 0.7,
  includeMetadata: true,
  searchFaqs: true,
  rerank: false,
};

/**
 * RAG Service Class
 */
export class RagService {
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = getEmbeddingService();
  }

  /**
   * Search knowledge base for relevant content
   */
  async search(
    query: string,
    companyId: string,
    options: SearchOptions = {}
  ): Promise<RagContext> {
    const startTime = performance.now();
    const opts = { ...DEFAULT_SEARCH_OPTIONS, ...options };

    // Generate embedding for query
    const queryResult = await this.embeddingService.embed(query);
    const queryEmbedding = queryResult.embedding;

    // Search chunks and FAQs in parallel
    const [chunks, faqs] = await Promise.all([
      this.searchChunks(queryEmbedding, companyId, opts),
      opts.searchFaqs
        ? this.searchFaqs(queryEmbedding, companyId, opts)
        : Promise.resolve([]),
    ]);

    // Rerank if enabled
    const finalChunks = opts.rerank
      ? await this.rerankResults(query, chunks)
      : chunks;

    const searchTimeMs = performance.now() - startTime;

    return {
      chunks: finalChunks,
      faqs,
      totalResults: finalChunks.length + faqs.length,
      searchTimeMs,
    };
  }

  /**
   * Search knowledge chunks using vector similarity
   */
  private async searchChunks(
    queryEmbedding: number[],
    companyId: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const { limit = 5, minScore = 0.7, sources } = options;

    // Build the query using Supabase's vector similarity search
    // This uses pgvector's <=> operator for cosine distance
    const embeddingStr = `[${queryEmbedding.join(",")}]`;

    // Use raw SQL for vector search since Drizzle doesn't have native pgvector support
    const results = await db.execute<{
      id: string;
      content: string;
      chunk_index: number;
      metadata: Record<string, unknown>;
      source_id: string;
      source_name: string;
      source_type: string;
      similarity: number;
    }>(sql`
      SELECT
        kc.id,
        kc.content,
        kc.chunk_index,
        kc.metadata,
        kc.source_id,
        ks.name as source_name,
        ks.type as source_type,
        1 - (kc.embedding <=> ${embeddingStr}::vector) as similarity
      FROM chatapp_knowledge_chunks kc
      JOIN chatapp_knowledge_sources ks ON kc.source_id = ks.id
      WHERE ks.company_id = ${companyId}
        AND ks.status = 'indexed'
        AND ks.deleted_at IS NULL
        AND kc.embedding IS NOT NULL
        ${sources && sources.length > 0 ? sql`AND kc.source_id = ANY(${sources})` : sql``}
      ORDER BY kc.embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `);

    // Filter by minimum score and map results
    const searchResults: SearchResult[] = [];

    for (const row of results) {
      const score = Number(row.similarity);
      if (score >= minScore) {
        searchResults.push({
          content: row.content,
          score,
          sourceId: row.source_id,
          sourceName: row.source_name,
          sourceType: row.source_type,
          chunkIndex: row.chunk_index,
          metadata: options.includeMetadata ? row.metadata : undefined,
        });
      }
    }

    return searchResults;
  }

  /**
   * Search FAQ items using vector similarity
   */
  private async searchFaqs(
    queryEmbedding: number[],
    companyId: string,
    options: SearchOptions
  ): Promise<FaqSearchResult[]> {
    const { limit = 3, minScore = 0.75 } = options;
    const embeddingStr = `[${queryEmbedding.join(",")}]`;

    const results = await db.execute<{
      id: string;
      question: string;
      answer: string;
      category: string | null;
      similarity: number;
    }>(sql`
      SELECT
        id,
        question,
        answer,
        category,
        1 - (embedding <=> ${embeddingStr}::vector) as similarity
      FROM chatapp_faq_items
      WHERE company_id = ${companyId}
        AND deleted_at IS NULL
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `);

    const searchResults: FaqSearchResult[] = [];

    for (const row of results) {
      const score = Number(row.similarity);
      if (score >= minScore) {
        searchResults.push({
          id: row.id,
          question: row.question,
          answer: row.answer,
          category: row.category,
          score,
        });
      }
    }

    return searchResults;
  }

  /**
   * Rerank results using cross-encoder style scoring
   * For now, this uses a simple keyword matching boost
   */
  private async rerankResults(
    query: string,
    results: SearchResult[]
  ): Promise<SearchResult[]> {
    // Extract keywords from query
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    // Score based on keyword presence
    const scored = results.map((result) => {
      const contentLower = result.content.toLowerCase();
      let keywordBoost = 0;

      for (const keyword of keywords) {
        if (contentLower.includes(keyword)) {
          keywordBoost += 0.05; // Small boost per keyword match
        }
      }

      // Clamp final score to [0, 1]
      const adjustedScore = Math.min(1, result.score + keywordBoost);

      return { ...result, score: adjustedScore };
    });

    // Re-sort by adjusted score
    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Build context string from search results for LLM
   */
  buildContextString(context: RagContext): string {
    const parts: string[] = [];

    // Add FAQ matches first (most likely direct answers)
    if (context.faqs.length > 0) {
      parts.push("## Relevant FAQs\n");
      for (const faq of context.faqs) {
        parts.push(`Q: ${faq.question}`);
        parts.push(`A: ${faq.answer}\n`);
      }
    }

    // Add knowledge base chunks
    if (context.chunks.length > 0) {
      parts.push("## Knowledge Base\n");
      for (let i = 0; i < context.chunks.length; i++) {
        const chunk = context.chunks[i];
        if (!chunk) continue;
        const sourceInfo = chunk.sourceName
          ? ` (Source: ${chunk.sourceName})`
          : "";
        parts.push(`[${i + 1}]${sourceInfo}`);
        parts.push(chunk.content);
        parts.push("");
      }
    }

    return parts.join("\n");
  }

  /**
   * Get knowledge source statistics for a company
   */
  async getKnowledgeStats(companyId: string): Promise<{
    totalSources: number;
    totalChunks: number;
    totalFaqs: number;
    sourcesByType: Record<string, number>;
    indexedSources: number;
  }> {
    const [sources, chunkCount, faqCount] = await Promise.all([
      db
        .select({
          type: knowledgeSources.type,
          status: knowledgeSources.status,
        })
        .from(knowledgeSources)
        .where(
          and(
            eq(knowledgeSources.companyId, companyId),
            isNull(knowledgeSources.deletedAt)
          )
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(knowledgeChunks)
        .innerJoin(
          knowledgeSources,
          eq(knowledgeChunks.sourceId, knowledgeSources.id)
        )
        .where(
          and(
            eq(knowledgeSources.companyId, companyId),
            isNull(knowledgeSources.deletedAt)
          )
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(faqItems)
        .where(
          and(
            eq(faqItems.companyId, companyId),
            isNull(faqItems.deletedAt)
          )
        ),
    ]);

    const sourcesByType: Record<string, number> = {};
    let indexedCount = 0;

    for (const source of sources) {
      sourcesByType[source.type] = (sourcesByType[source.type] || 0) + 1;
      if (source.status === "indexed") {
        indexedCount++;
      }
    }

    return {
      totalSources: sources.length,
      totalChunks: chunkCount[0]?.count ?? 0,
      totalFaqs: faqCount[0]?.count ?? 0,
      sourcesByType,
      indexedSources: indexedCount,
    };
  }
}

// Export singleton instance
let ragServiceInstance: RagService | null = null;

export function getRagService(): RagService {
  if (!ragServiceInstance) {
    ragServiceInstance = new RagService();
  }
  return ragServiceInstance;
}

// Export utility function for quick search
export async function searchKnowledge(
  query: string,
  companyId: string,
  options?: SearchOptions
): Promise<RagContext> {
  const service = getRagService();
  return service.search(query, companyId, options);
}

// Export function to build context string
export function buildKnowledgeContext(context: RagContext): string {
  const service = getRagService();
  return service.buildContextString(context);
}

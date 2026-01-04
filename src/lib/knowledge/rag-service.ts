/**
 * RAG (Retrieval-Augmented Generation) Service
 *
 * Provides semantic search over knowledge base using Qdrant vector storage.
 * Features:
 * - Qdrant vector search (replaces pgvector)
 * - LLM-based query expansion
 * - Cross-encoder style reranking
 * - Parent/sibling context expansion
 */

import { db } from "@/lib/db";
import { knowledgeSources, faqItems } from "@/lib/db/schema/knowledge";
import { eq, and, isNull, sql } from "drizzle-orm";
import { getEmbeddingService, EmbeddingService } from "./embedding-service";
import {
  getQdrantService,
  searchChunks,
  searchFaqs,
  COLLECTIONS,
  type VectorPayload,
  type FaqPayload,
  type SearchHit,
} from "./qdrant-client";
import OpenAI from "openai";

// Types
export interface SearchOptions {
  limit?: number;
  minScore?: number;
  sources?: string[]; // Filter by source IDs
  categories?: string[]; // Filter by category names
  includeMetadata?: boolean;
  searchFaqs?: boolean;
  rerank?: boolean;
  expandQuery?: boolean; // Enable LLM-based query expansion
  expandContext?: boolean; // Enable parent/sibling context expansion
  maxExpansions?: number; // Max number of expanded queries
  rerankModel?: "keyword" | "cross-encoder"; // Reranking method
}

export interface SearchResult {
  content: string;
  score: number;
  sourceId: string;
  sourceName?: string;
  sourceType?: string;
  chunkIndex?: number;
  metadata?: Record<string, unknown>;
  expandedContext?: string; // Additional context from parent/siblings
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
  expandedQueries?: string[]; // Queries used for search
}

export interface QueryExpansion {
  original: string;
  expanded: string[];
  reasoning?: string;
}

// Default options
const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  limit: 5,
  minScore: 0.7,
  includeMetadata: true,
  searchFaqs: true,
  rerank: true,
  expandQuery: true,
  expandContext: true,
  maxExpansions: 3,
  rerankModel: "cross-encoder",
};

/**
 * RAG Service Class
 */
export class RagService {
  private embeddingService: EmbeddingService;
  private openai: OpenAI | null = null;

  constructor() {
    this.embeddingService = getEmbeddingService();

    // Initialize OpenAI for query expansion
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
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

    // Step 1: Query expansion (if enabled)
    let searchQueries = [query];
    let expandedQueries: string[] | undefined;

    if (opts.expandQuery && this.openai) {
      const expansion = await this.expandQuery(query, opts.maxExpansions ?? 3);
      searchQueries = [query, ...expansion.expanded];
      expandedQueries = expansion.expanded;
    }

    // Step 2: Generate embeddings for all search queries
    const embeddings = await Promise.all(
      searchQueries.map((q) => this.embeddingService.embed(q))
    );

    // Step 3: Search chunks and FAQs in parallel using Qdrant
    const [chunkResults, faqResults] = await Promise.all([
      this.searchChunksMultiQuery(
        embeddings.map((e) => e.embedding),
        companyId,
        opts
      ),
      opts.searchFaqs
        ? this.searchFaqsMultiQuery(
            embeddings.map((e) => e.embedding),
            companyId,
            opts
          )
        : Promise.resolve([]),
    ]);

    // Step 4: Deduplicate and merge results
    const mergedChunks = this.deduplicateResults(chunkResults);

    // Step 5: Rerank results (if enabled)
    let finalChunks = mergedChunks;
    if (opts.rerank) {
      finalChunks = await this.rerankResults(
        query,
        mergedChunks,
        opts.rerankModel ?? "cross-encoder"
      );
    }

    // Step 6: Expand context with parent/siblings (if enabled)
    if (opts.expandContext) {
      finalChunks = await this.expandResultContext(finalChunks, companyId);
    }

    // Step 7: Apply limit after all processing
    finalChunks = finalChunks.slice(0, opts.limit ?? 5);

    const searchTimeMs = performance.now() - startTime;

    return {
      chunks: finalChunks,
      faqs: faqResults.slice(0, Math.max(3, Math.floor((opts.limit ?? 5) / 2))),
      totalResults: finalChunks.length + faqResults.length,
      searchTimeMs,
      expandedQueries,
    };
  }

  /**
   * Expand query using LLM
   */
  private async expandQuery(
    query: string,
    maxExpansions: number
  ): Promise<QueryExpansion> {
    if (!this.openai) {
      return { original: query, expanded: [] };
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a search query expansion assistant. Given a user query, generate ${maxExpansions} alternative queries that:
1. Use synonyms or related terms
2. Rephrase the question differently
3. Include related concepts that might be in relevant documents

Return ONLY a JSON object with this format:
{"expanded": ["query1", "query2", "query3"], "reasoning": "brief explanation"}

Keep queries concise and focused on the original intent.`,
          },
          {
            role: "user",
            content: `Original query: "${query}"`,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      });

      const content = response.choices[0]?.message?.content ?? "{}";

      // Parse JSON response
      const parsed = JSON.parse(content) as {
        expanded?: string[];
        reasoning?: string;
      };

      return {
        original: query,
        expanded: parsed.expanded?.slice(0, maxExpansions) ?? [],
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      console.error("Query expansion failed:", error);
      return { original: query, expanded: [] };
    }
  }

  /**
   * Search chunks using multiple query embeddings
   */
  private async searchChunksMultiQuery(
    embeddings: number[][],
    companyId: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];

    for (const embedding of embeddings) {
      const hits = await searchChunks(embedding, companyId, {
        limit: (options.limit ?? 5) * 2, // Get more results for merging
        sourceIds: options.sources,
        categories: options.categories,
        scoreThreshold: options.minScore ?? 0.7,
      });

      for (const hit of hits) {
        if (hit.payload) {
          allResults.push({
            content: hit.payload.content,
            score: hit.score,
            sourceId: hit.payload.sourceId,
            chunkIndex: hit.payload.chunkIndex,
            metadata: options.includeMetadata ? hit.payload.metadata : undefined,
          });
        }
      }
    }

    return allResults;
  }

  /**
   * Search FAQs using multiple query embeddings
   */
  private async searchFaqsMultiQuery(
    embeddings: number[][],
    companyId: string,
    options: SearchOptions
  ): Promise<FaqSearchResult[]> {
    const allResults: Map<string, FaqSearchResult> = new Map();

    for (const embedding of embeddings) {
      const hits = await searchFaqs(embedding, companyId, {
        limit: 5,
        scoreThreshold: (options.minScore ?? 0.7) + 0.05, // Slightly higher threshold for FAQs
      });

      for (const hit of hits) {
        if (hit.payload) {
          const id = String(hit.id);
          const existing = allResults.get(id);

          // Keep the higher score
          if (!existing || hit.score > existing.score) {
            allResults.set(id, {
              id,
              question: hit.payload.question,
              answer: hit.payload.answer,
              category: hit.payload.category,
              score: hit.score,
            });
          }
        }
      }
    }

    return Array.from(allResults.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Deduplicate results from multiple queries
   */
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Map<string, SearchResult>();

    for (const result of results) {
      // Create a key based on content hash (simplified)
      const key = `${result.sourceId}:${result.chunkIndex}`;
      const existing = seen.get(key);

      if (!existing || result.score > existing.score) {
        seen.set(key, result);
      }
    }

    return Array.from(seen.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Rerank results using cross-encoder style scoring
   */
  private async rerankResults(
    query: string,
    results: SearchResult[],
    method: "keyword" | "cross-encoder"
  ): Promise<SearchResult[]> {
    if (results.length === 0) return results;

    if (method === "cross-encoder" && this.openai) {
      return this.rerankWithCrossEncoder(query, results);
    }

    return this.rerankWithKeywords(query, results);
  }

  /**
   * Rerank using LLM as cross-encoder
   */
  private async rerankWithCrossEncoder(
    query: string,
    results: SearchResult[]
  ): Promise<SearchResult[]> {
    if (!this.openai || results.length === 0) return results;

    try {
      // Limit to top results for efficiency
      const topResults = results.slice(0, 10);

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a relevance scoring assistant. Score each document passage for relevance to the query on a scale of 0.0 to 1.0.

Return ONLY a JSON array of scores in the same order as the passages.
Example: [0.95, 0.72, 0.45, 0.88]

Consider:
- Direct answer to the query (highest score)
- Related information that provides context
- Tangentially related content (lower score)
- Irrelevant content (0.0)`,
          },
          {
            role: "user",
            content: `Query: "${query}"

Passages:
${topResults.map((r, i) => `[${i}] ${r.content.slice(0, 1000)}`).join("\n\n")}`,
          },
        ],
        temperature: 0,
        max_tokens: 200,
      });

      let content = response.choices[0]?.message?.content ?? "[]";

      // Strip markdown code blocks if present (e.g., ```json\n[...]\n```)
      content = content.trim();
      if (content.startsWith("```")) {
        // Remove opening ```json or ``` and closing ```
        content = content
          .replace(/^```(?:json)?\s*\n?/, "")
          .replace(/\n?```\s*$/, "")
          .trim();
      }

      const scores = JSON.parse(content) as number[];

      // Apply new scores using weighted blend
      // LLM score adjusts but doesn't completely override semantic similarity
      // - LLM score 0.0 = 0.5x multiplier (halves score, doesn't zero it)
      // - LLM score 0.5 = 1.0x multiplier (no change)
      // - LLM score 1.0 = 1.5x multiplier (50% boost)
      const scored = topResults.map((result, i) => {
        const llmScore = scores[i] ?? 0.5; // Default to neutral if missing
        const boostFactor = 0.5 + llmScore; // Range: 0.5 to 1.5
        return {
          ...result,
          score: Math.min(1, result.score * boostFactor),
        };
      });

      // Add back any results not in top 10
      const remaining = results.slice(10).map((r) => ({
        ...r,
        score: r.score * 0.8, // Slightly penalize for not being in top 10
      }));

      return [...scored, ...remaining].sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error("Cross-encoder reranking failed:", error);
      return this.rerankWithKeywords(query, results);
    }
  }

  /**
   * Rerank using keyword matching (fallback)
   */
  private rerankWithKeywords(
    query: string,
    results: SearchResult[]
  ): SearchResult[] {
    // Extract keywords from query
    const keywords = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3);

    // Score based on keyword presence and density
    const scored = results.map((result) => {
      const contentLower = result.content.toLowerCase();
      let keywordBoost = 0;
      let exactPhraseBoost = 0;

      // Check for exact phrase match
      if (contentLower.includes(query.toLowerCase())) {
        exactPhraseBoost = 0.15;
      }

      // Check keyword matches
      for (const keyword of keywords) {
        const matches = (contentLower.match(new RegExp(keyword, "g")) ?? []).length;
        keywordBoost += Math.min(matches * 0.02, 0.1);
      }

      // Clamp final score to [0, 1]
      const adjustedScore = Math.min(1, result.score + keywordBoost + exactPhraseBoost);

      return { ...result, score: adjustedScore };
    });

    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Expand result context with parent/sibling chunks
   */
  private async expandResultContext(
    results: SearchResult[],
    companyId: string
  ): Promise<SearchResult[]> {
    const qdrant = getQdrantService();
    const expandedResults: SearchResult[] = [];

    for (const result of results) {
      let expandedContext = "";

      // Check for sibling chunk IDs in metadata
      const siblingIds = (result.metadata?.siblingChunkIds as string[]) ?? [];

      if (siblingIds.length > 0) {
        try {
          // Fetch sibling chunks from Qdrant
          const siblings = await qdrant.getByIds<VectorPayload>(
            COLLECTIONS.KNOWLEDGE_CHUNKS,
            siblingIds.map((id) => `${result.sourceId}:${id}`)
          );

          // Add sibling content as context
          const siblingContent = siblings
            .filter((s) => s.payload?.companyId === companyId)
            .map((s) => s.payload?.content ?? "")
            .filter((c) => c.length > 0);

          if (siblingContent.length > 0) {
            expandedContext = siblingContent.join("\n---\n");
          }
        } catch {
          // Sibling expansion failed, continue without
        }
      }

      expandedResults.push({
        ...result,
        expandedContext: expandedContext || undefined,
      });
    }

    return expandedResults;
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

        // Include expanded context if available
        if (chunk.expandedContext) {
          parts.push("\n[Additional context:]");
          parts.push(chunk.expandedContext);
        }

        parts.push("");
      }
    }

    // Add expanded queries info for debugging
    if (context.expandedQueries && context.expandedQueries.length > 0) {
      parts.push(`\n<!-- Search included: ${context.expandedQueries.join("; ")} -->`);
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
    const [sources, faqCount] = await Promise.all([
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
        .from(faqItems)
        .where(
          and(
            eq(faqItems.companyId, companyId),
            isNull(faqItems.deletedAt)
          )
        ),
    ]);

    // Get chunk count from Qdrant
    let chunkCount = 0;
    try {
      const qdrant = getQdrantService();
      chunkCount = await qdrant.count(COLLECTIONS.KNOWLEDGE_CHUNKS, {
        must: [{ key: "companyId", match: { value: companyId } }],
      });
    } catch {
      // Qdrant not available, return 0
    }

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
      totalChunks: chunkCount,
      totalFaqs: faqCount[0]?.count ?? 0,
      sourcesByType,
      indexedSources: indexedCount,
    };
  }

  /**
   * Perform hybrid search combining semantic and keyword search
   */
  async hybridSearch(
    query: string,
    companyId: string,
    options: SearchOptions & { keywordWeight?: number } = {}
  ): Promise<RagContext> {
    const { keywordWeight = 0.3, ...searchOptions } = options;

    // Perform regular semantic search
    const semanticResults = await this.search(query, companyId, {
      ...searchOptions,
      rerank: false, // We'll combine before reranking
    });

    // If no results or keyword weight is 0, return semantic results
    if (semanticResults.chunks.length === 0 || keywordWeight === 0) {
      return semanticResults;
    }

    // Perform basic keyword search using Qdrant scroll with payload filter
    // This is a simplified keyword search - in production, you might use
    // a dedicated full-text search engine like Elasticsearch
    const keywordResults = await this.keywordSearch(query, companyId, options);

    // Combine results with weighted scores
    const combinedResults = this.combineSearchResults(
      semanticResults.chunks,
      keywordResults,
      1 - keywordWeight,
      keywordWeight
    );

    // Rerank combined results if enabled
    let finalChunks = combinedResults;
    if (options.rerank) {
      finalChunks = await this.rerankResults(
        query,
        combinedResults,
        options.rerankModel ?? "cross-encoder"
      );
    }

    return {
      ...semanticResults,
      chunks: finalChunks.slice(0, options.limit ?? 5),
    };
  }

  /**
   * Simple keyword search using Qdrant payload filtering
   */
  private async keywordSearch(
    query: string,
    companyId: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    // Extract keywords
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (keywords.length === 0) return [];

    const qdrant = getQdrantService();
    const results: SearchResult[] = [];

    try {
      // Scroll through chunks and filter by keyword presence
      // Note: This is not efficient for large datasets - consider using
      // a proper full-text search engine for production
      let offset: string | number | null = null;
      const maxIterations = 10;
      let iterations = 0;

      while (iterations < maxIterations) {
        const response: {
          points: Array<{ id: string | number; score: number; payload?: VectorPayload }>;
          nextOffset?: string | number | null;
        } = await qdrant.scroll<VectorPayload>(
          COLLECTIONS.KNOWLEDGE_CHUNKS,
          {
            filter: {
              must: [{ key: "companyId", match: { value: companyId } }],
            },
            limit: 100,
            offset,
            withPayload: true,
          }
        );

        for (const point of response.points) {
          if (!point.payload) continue;

          const content = point.payload.content.toLowerCase();
          const matchCount = keywords.filter((k) => content.includes(k)).length;
          const score = matchCount / keywords.length;

          if (score >= 0.5) {
            results.push({
              content: point.payload.content,
              score,
              sourceId: point.payload.sourceId,
              chunkIndex: point.payload.chunkIndex,
              metadata: options.includeMetadata ? point.payload.metadata : undefined,
            });
          }
        }

        offset = response.nextOffset ?? null;
        if (!offset || results.length >= 20) break;
        iterations++;
      }
    } catch (error) {
      console.error("Keyword search failed:", error);
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 10);
  }

  /**
   * Combine semantic and keyword search results
   */
  private combineSearchResults(
    semantic: SearchResult[],
    keyword: SearchResult[],
    semanticWeight: number,
    keywordWeight: number
  ): SearchResult[] {
    const combined = new Map<string, SearchResult>();

    // Add semantic results with weight
    for (const result of semantic) {
      const key = `${result.sourceId}:${result.chunkIndex}`;
      combined.set(key, {
        ...result,
        score: result.score * semanticWeight,
      });
    }

    // Add keyword results with weight, combining if exists
    for (const result of keyword) {
      const key = `${result.sourceId}:${result.chunkIndex}`;
      const existing = combined.get(key);

      if (existing) {
        existing.score += result.score * keywordWeight;
      } else {
        combined.set(key, {
          ...result,
          score: result.score * keywordWeight,
        });
      }
    }

    return Array.from(combined.values()).sort((a, b) => b.score - a.score);
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

// Export hybrid search function
export async function hybridSearchKnowledge(
  query: string,
  companyId: string,
  options?: SearchOptions & { keywordWeight?: number }
): Promise<RagContext> {
  const service = getRagService();
  return service.hybridSearch(query, companyId, options);
}

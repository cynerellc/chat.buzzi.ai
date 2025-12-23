/**
 * RAG Service - Retrieval-Augmented Generation
 *
 * This service provides knowledge retrieval capabilities for AI agents.
 * Supports both vector-based semantic search and fallback keyword search.
 *
 * Features:
 * - Vector-based semantic search (via knowledge module)
 * - Full-text search fallback
 * - Category-based filtering
 * - Relevance scoring
 * - Source citation
 */

import { db } from "@/lib/db";
import { knowledgeChunks, knowledgeSources } from "@/lib/db/schema/knowledge";
import { eq, and, inArray, ilike, or } from "drizzle-orm";

// Import vector-based RAG service when available
import { searchKnowledge, buildKnowledgeContext } from "@/lib/knowledge";

import type { RAGConfig, RAGSource, ToolResult, AgentContext } from "../types";

// ============================================================================
// Types
// ============================================================================

export interface RAGSearchOptions {
  query: string;
  companyId: string;
  sourceIds?: string[];
  categoryIds?: string[];
  limit?: number;
  threshold?: number;
}

export interface RAGResult {
  id: string;
  content: string;
  similarity: number;
  source: RAGSource;
  metadata?: Record<string, unknown>;
}

export interface RAGContext {
  results: RAGResult[];
  formattedContext: string;
  sources: RAGSource[];
}

// ============================================================================
// RAG Service Class
// ============================================================================

export class RAGService {
  private config: RAGConfig;

  constructor(config: RAGConfig) {
    this.config = config;
  }

  /**
   * Search for relevant knowledge chunks
   * Uses vector-based semantic search when available, falls back to keyword search
   */
  async search(options: RAGSearchOptions): Promise<RAGResult[]> {
    if (!this.config.enabled) {
      return [];
    }

    const {
      query,
      companyId,
      sourceIds,
      categoryIds: _categoryIds, // TODO: Implement category filtering
      limit = this.config.maxResults,
      threshold = this.config.relevanceThreshold,
    } = options;

    try {
      // Try vector-based semantic search first
      try {
        const vectorContext = await searchKnowledge(query, companyId, {
          limit,
          minScore: threshold,
          sources: sourceIds,
          searchFaqs: true,
        });

        if (vectorContext.chunks.length > 0 || vectorContext.faqs.length > 0) {
          // Convert vector results to RAGResult format
          const results: RAGResult[] = vectorContext.chunks.map((chunk) => ({
            id: chunk.sourceId + "-" + chunk.chunkIndex,
            content: chunk.content,
            similarity: chunk.score,
            source: {
              id: chunk.sourceId,
              fileName: chunk.sourceName ?? "Unknown",
              category: chunk.sourceType,
              chunkIndex: chunk.chunkIndex,
              relevanceScore: chunk.score,
            },
            metadata: chunk.metadata,
          }));

          // Add FAQ results as synthetic chunks with high relevance
          for (const faq of vectorContext.faqs) {
            results.push({
              id: "faq-" + faq.id,
              content: `Q: ${faq.question}\nA: ${faq.answer}`,
              similarity: faq.score,
              source: {
                id: faq.id,
                fileName: "FAQ",
                category: faq.category ?? "General",
                relevanceScore: faq.score,
              },
            });
          }

          return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
        }
      } catch (vectorError) {
        // Vector search failed (maybe no embeddings yet), fall back to keyword search
        console.debug("Vector search not available, using keyword fallback:", vectorError);
      }

      // Fallback: keyword-based search
      return this.keywordSearch(options);
    } catch (error) {
      console.error("RAG search error:", error);
      return [];
    }
  }

  /**
   * Fallback keyword-based search when vector search is not available
   */
  private async keywordSearch(options: RAGSearchOptions): Promise<RAGResult[]> {
    const {
      query,
      companyId,
      sourceIds,
      limit = this.config.maxResults,
      threshold = this.config.relevanceThreshold,
    } = options;

    // Get knowledge sources for the company
    const sourceConditions = [eq(knowledgeSources.companyId, companyId)];

    if (sourceIds && sourceIds.length > 0) {
      sourceConditions.push(inArray(knowledgeSources.id, sourceIds));
    }

    const sources = await db
      .select()
      .from(knowledgeSources)
      .where(and(...sourceConditions));

    if (sources.length === 0) {
      return [];
    }

    const sourceIdList = sources.map((s) => s.id);

    // Search chunks using text matching
    // Split query into keywords for better matching
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((k) => k.length > 2);

    if (keywords.length === 0) {
      return [];
    }

    // Build search conditions
    const searchConditions = keywords.map((keyword) =>
      ilike(knowledgeChunks.content, `%${keyword}%`)
    );

    const chunks = await db
      .select({
        chunk: knowledgeChunks,
        source: knowledgeSources,
      })
      .from(knowledgeChunks)
      .innerJoin(
        knowledgeSources,
        eq(knowledgeChunks.sourceId, knowledgeSources.id)
      )
      .where(
        and(
          inArray(knowledgeChunks.sourceId, sourceIdList),
          or(...searchConditions)
        )
      )
      .limit(limit * 2); // Get more than needed for filtering

    // Calculate relevance scores based on keyword matches
    const results: RAGResult[] = chunks.map(({ chunk, source }) => {
      const content = chunk.content.toLowerCase();
      let matchCount = 0;

      for (const keyword of keywords) {
        if (content.includes(keyword)) {
          matchCount++;
        }
      }

      // Simple relevance score based on keyword match percentage
      const similarity = matchCount / keywords.length;

      // Get category from source metadata if available
      const sourceMetadata = source.metadata as Record<string, unknown> | null;
      const category = sourceMetadata?.category as string | undefined;

      return {
        id: chunk.id,
        content: chunk.content,
        similarity,
        source: {
          id: source.id,
          fileName: source.name,
          category,
          chunkIndex: chunk.chunkIndex,
          relevanceScore: similarity,
        },
        metadata: chunk.metadata as Record<string, unknown>,
      };
    });

    // Filter by threshold and sort by relevance
    const filteredResults = results
      .filter((r) => r.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return filteredResults;
  }

  /**
   * Search and format results for LLM context
   */
  async searchWithContext(options: RAGSearchOptions): Promise<RAGContext> {
    const results = await this.search(options);

    if (results.length === 0) {
      return {
        results: [],
        formattedContext: "",
        sources: [],
      };
    }

    // Format results for inclusion in LLM prompt
    const formattedContext = this.formatResults(results);
    const sources = results.map((r) => r.source);

    return {
      results,
      formattedContext,
      sources,
    };
  }

  /**
   * Format RAG results for LLM context injection
   */
  formatResults(results: RAGResult[]): string {
    if (results.length === 0) {
      return "";
    }

    const sections = results.map((result, index) => {
      const sourceInfo = result.source.fileName
        ? `[Source: ${result.source.fileName}]`
        : `[Source ${index + 1}]`;

      return `${sourceInfo}\n${result.content}`;
    });

    return [
      "---",
      "RELEVANT KNOWLEDGE BASE INFORMATION:",
      "---",
      ...sections,
      "---",
      "Use the above information to help answer the user's question.",
      "If the information is relevant, cite the source in your response.",
      "---",
    ].join("\n");
  }

  /**
   * Create a tool executor for the search_knowledge tool
   */
  createSearchToolExecutor() {
    return async (
      params: Record<string, unknown>,
      context: AgentContext
    ): Promise<ToolResult> => {
      const query = params.query as string;
      const _category = params.category as string | undefined; // TODO: Use category filtering
      const maxResults = (params.maxResults as number) || this.config.maxResults;

      const results = await this.search({
        query,
        companyId: context.companyId,
        sourceIds: this.config.categoryIds,
        limit: maxResults,
      });

      if (results.length === 0) {
        return {
          success: true,
          data: {
            message: "No relevant information found in the knowledge base.",
            results: [],
          },
        };
      }

      return {
        success: true,
        data: {
          message: `Found ${results.length} relevant result(s).`,
          results: results.map((r) => ({
            content: r.content,
            source: r.source.fileName,
            relevance: Math.round(r.similarity * 100) + "%",
          })),
        },
      };
    };
  }

  /**
   * Check if RAG is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RAGConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createRAGService(config: RAGConfig): RAGService {
  return new RAGService(config);
}

// Default configuration
export const defaultRAGConfig: RAGConfig = {
  enabled: false,
  maxResults: 5,
  relevanceThreshold: 0.5,
  categoryIds: [],
};

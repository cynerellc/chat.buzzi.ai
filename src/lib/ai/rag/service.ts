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

// Import vector-based RAG service
import { searchKnowledge } from "@/lib/knowledge";
import { profiler } from "@/lib/profiler";

import type { RAGConfig, RAGSource, ToolResult, AgentContext } from "../types";

// ============================================================================
// Types
// ============================================================================

export interface RAGSearchOptions {
  query: string;
  companyId: string;
  sourceIds?: string[];
  categories?: string[]; // Category names for filtering
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

    const ragSpan = profiler.startSpan("rag_search", "rag");

    const {
      query,
      companyId,
      sourceIds,
      categories,
      limit = this.config.maxResults,
      threshold = this.config.relevanceThreshold,
    } = options;

    try {
      // Use vector-based semantic search via Qdrant
      const vectorSpan = profiler.startSpan("rag_vector_search", "rag", {
        queryLength: query.length,
        limit,
      });
      const vectorContext = await searchKnowledge(query, companyId, {
        limit,
        minScore: threshold,
        sources: sourceIds,
        categories,
        searchFaqs: true,
      });
      vectorSpan.end({ chunkCount: vectorContext.chunks.length, faqCount: vectorContext.faqs.length });

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

      const sortedResults = results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
      ragSpan.end({ resultCount: sortedResults.length });
      return sortedResults;
    } catch (error) {
      console.error("RAG search error:", error);
      ragSpan.end({ error: true });
      return [];
    }
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
      const maxResults = (params.maxResults as number) || this.config.maxResults;

      const results = await this.search({
        query,
        companyId: context.companyId,
        categories: this.config.categories,
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
  categories: [],
};

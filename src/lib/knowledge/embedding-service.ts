/**
 * Embedding Service
 *
 * Generates vector embeddings using OpenAI's embedding models.
 * Supports batching, caching, and dimension reduction.
 */

import OpenAI from "openai";

// Types
export interface EmbeddingOptions {
  model?: EmbeddingModel;
  dimensions?: number; // For text-embedding-3 models
  batchSize?: number;
}

export type EmbeddingModel =
  | "text-embedding-3-small"
  | "text-embedding-3-large"
  | "text-embedding-ada-002";

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

export interface BatchEmbeddingResult {
  embeddings: EmbeddingResult[];
  totalTokens: number;
  model: string;
}

// Default configuration
const DEFAULT_MODEL: EmbeddingModel = "text-embedding-3-small";
const DEFAULT_BATCH_SIZE = 100; // OpenAI supports up to 2048, but 100 is safer
const MAX_INPUT_TOKENS = 8191; // OpenAI limit

// Model dimensions
const MODEL_DIMENSIONS: Record<EmbeddingModel, number> = {
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
  "text-embedding-ada-002": 1536,
};

/**
 * Embedding Service Class
 */
export class EmbeddingService {
  private client: OpenAI;
  private model: EmbeddingModel;
  private dimensions?: number;
  private batchSize: number;

  constructor(options: EmbeddingOptions = {}) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }

    this.client = new OpenAI({ apiKey });
    this.model = options.model ?? DEFAULT_MODEL;
    this.dimensions = options.dimensions;
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;

    // Validate dimensions for text-embedding-3 models
    if (this.dimensions && !this.model.startsWith("text-embedding-3")) {
      console.warn(
        "Custom dimensions only supported with text-embedding-3 models"
      );
      this.dimensions = undefined;
    }
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<EmbeddingResult> {
    const result = await this.embedBatch([text]);
    const embedding = result.embeddings[0];
    if (!embedding) {
      throw new Error("No embedding returned from API");
    }
    return embedding;
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    if (texts.length === 0) {
      return {
        embeddings: [],
        totalTokens: 0,
        model: this.model,
      };
    }

    // Preprocess texts
    const processedTexts = texts.map((text) => this.preprocessText(text));

    // If batch is small enough, process in one request
    if (processedTexts.length <= this.batchSize) {
      return this.requestEmbeddings(processedTexts);
    }

    // Process in batches
    const allEmbeddings: EmbeddingResult[] = [];
    let totalTokens = 0;

    for (let i = 0; i < processedTexts.length; i += this.batchSize) {
      const batch = processedTexts.slice(i, i + this.batchSize);
      const result = await this.requestEmbeddings(batch);
      allEmbeddings.push(...result.embeddings);
      totalTokens += result.totalTokens;

      // Add small delay between batches to avoid rate limiting
      if (i + this.batchSize < processedTexts.length) {
        await this.sleep(100);
      }
    }

    return {
      embeddings: allEmbeddings,
      totalTokens,
      model: this.model,
    };
  }

  /**
   * Make API request for embeddings
   */
  private async requestEmbeddings(
    texts: string[]
  ): Promise<BatchEmbeddingResult> {
    try {
      const params: OpenAI.EmbeddingCreateParams = {
        model: this.model,
        input: texts,
      };

      // Add dimensions for text-embedding-3 models
      if (this.dimensions && this.model.startsWith("text-embedding-3")) {
        params.dimensions = this.dimensions;
      }

      const response = await this.client.embeddings.create(params);

      // Sort by index to ensure order matches input
      const sortedData = [...response.data].sort((a, b) => a.index - b.index);

      const embeddings: EmbeddingResult[] = sortedData.map((item) => ({
        embedding: item.embedding,
        tokenCount: 0, // Individual token counts not available in batch
      }));

      return {
        embeddings,
        totalTokens: response.usage.total_tokens,
        model: response.model,
      };
    } catch (error) {
      if (error instanceof OpenAI.RateLimitError) {
        // Handle rate limiting with retry
        const retryAfter = this.getRetryAfter(error);
        await this.sleep(retryAfter);
        return this.requestEmbeddings(texts);
      }

      throw new EmbeddingError(
        `Failed to generate embeddings: ${error instanceof Error ? error.message : "Unknown error"}`,
        error
      );
    }
  }

  /**
   * Preprocess text for embedding
   */
  private preprocessText(text: string): string {
    // Remove excessive whitespace
    let processed = text.replace(/\s+/g, " ").trim();

    // Estimate tokens (rough: ~4 chars per token)
    const estimatedTokens = Math.ceil(processed.length / 4);

    // Truncate if too long
    if (estimatedTokens > MAX_INPUT_TOKENS) {
      // Leave some buffer
      const maxChars = (MAX_INPUT_TOKENS - 100) * 4;
      processed = processed.slice(0, maxChars);
    }

    return processed;
  }

  /**
   * Get retry delay from error
   */
  private getRetryAfter(error: unknown): number {
    const headers = (error as { headers?: Record<string, string> })?.headers;
    if (headers?.["retry-after"]) {
      const retryAfter = parseInt(headers["retry-after"], 10);
      if (!isNaN(retryAfter)) {
        return retryAfter * 1000;
      }
    }
    return 1000; // Default 1 second
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get the embedding dimension for current model
   */
  getDimension(): number {
    return this.dimensions ?? MODEL_DIMENSIONS[this.model];
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Embeddings must have same dimension");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i] ?? 0;
      const bVal = b[i] ?? 0;
      dotProduct += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  /**
   * Find most similar embeddings
   */
  static findMostSimilar(
    queryEmbedding: number[],
    candidates: Array<{ embedding: number[]; id: string; [key: string]: unknown }>,
    topK: number = 5
  ): Array<{ id: string; score: number; [key: string]: unknown }> {
    const scored = candidates.map((candidate) => ({
      ...candidate,
      score: EmbeddingService.cosineSimilarity(queryEmbedding, candidate.embedding),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ embedding: _embedding, ...rest }) => rest);
  }

  /**
   * Normalize embedding to unit length
   */
  static normalizeEmbedding(embedding: number[]): number[] {
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );
    if (magnitude === 0) return embedding;
    return embedding.map((val) => val / magnitude);
  }
}

/**
 * Custom error for embedding failures
 */
export class EmbeddingError extends Error {
  constructor(
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = "EmbeddingError";
  }
}

// Export singleton instance
let embeddingServiceInstance: EmbeddingService | null = null;

export function getEmbeddingService(options?: EmbeddingOptions): EmbeddingService {
  if (!embeddingServiceInstance || options) {
    embeddingServiceInstance = new EmbeddingService(options);
  }
  return embeddingServiceInstance;
}

// Export utility functions
export async function generateEmbedding(text: string): Promise<number[]> {
  const service = getEmbeddingService();
  const result = await service.embed(text);
  return result.embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const service = getEmbeddingService();
  const result = await service.embedBatch(texts);
  return result.embeddings.map((e) => e.embedding);
}

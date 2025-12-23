/**
 * Knowledge Processing Pipeline
 *
 * Orchestrates the full knowledge ingestion process:
 * 1. Extract text from documents
 * 2. Split into chunks
 * 3. Generate embeddings
 * 4. Store vectors in Qdrant and metadata in PostgreSQL
 */

import { db } from "@/lib/db";
import { knowledgeSources, knowledgeChunks, faqItems } from "@/lib/db/schema/knowledge";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { processDocument } from "./document-processor";
import { chunkText, CHUNKING_PRESETS, type TextChunk } from "./chunking-service";
import { getEmbeddingService } from "./embedding-service";
import {
  getQdrantService,
  storeChunks,
  storeFaq,
  deleteChunksBySource,
  deleteFaq,
  COLLECTIONS,
  type VectorPayload,
  type FaqPayload,
} from "./qdrant-client";

// Types
export interface ProcessingOptions {
  chunkingPreset?: keyof typeof CHUNKING_PRESETS;
  embedBatchSize?: number;
  onProgress?: (progress: ProcessingProgress) => void;
  useQdrant?: boolean; // Toggle between Qdrant and pgvector
  storeInPostgres?: boolean; // Also store in PostgreSQL for backup
}

export interface ProcessingProgress {
  stage: ProcessingStage;
  progress: number; // 0-100
  message: string;
  chunksProcessed?: number;
  totalChunks?: number;
}

export type ProcessingStage =
  | "extracting"
  | "chunking"
  | "embedding"
  | "storing"
  | "complete"
  | "failed";

export interface ProcessingResult {
  success: boolean;
  sourceId: string;
  chunksCreated: number;
  totalTokens: number;
  processingTimeMs: number;
  error?: string;
  vectorStore?: "qdrant" | "pgvector";
}

// Default configuration
const DEFAULT_EMBED_BATCH_SIZE = 50;

/**
 * Knowledge Processing Pipeline
 */
export class ProcessingPipeline {
  private embeddingService = getEmbeddingService();

  /**
   * Process a knowledge source from file upload
   */
  async processFile(
    sourceId: string,
    fileBuffer: Buffer,
    fileType: string,
    fileName: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = performance.now();
    const { onProgress } = options;

    try {
      // Update status to processing
      await this.updateSourceStatus(sourceId, "processing");
      onProgress?.({ stage: "extracting", progress: 0, message: "Extracting text from document" });

      // 1. Extract text from document
      const document = await processDocument(fileBuffer, fileType, fileName);
      onProgress?.({ stage: "extracting", progress: 100, message: "Text extraction complete" });

      // 2. Process the extracted content
      return await this.processContent(
        sourceId,
        document.content,
        options,
        startTime
      );
    } catch (error) {
      await this.handleProcessingError(sourceId, error);
      return {
        success: false,
        sourceId,
        chunksCreated: 0,
        totalTokens: 0,
        processingTimeMs: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Processing failed",
      };
    }
  }

  /**
   * Process a knowledge source from URL
   */
  async processUrl(
    sourceId: string,
    url: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = performance.now();
    const { onProgress } = options;

    try {
      await this.updateSourceStatus(sourceId, "processing");
      onProgress?.({ stage: "extracting", progress: 0, message: "Fetching URL content" });

      // Fetch URL content
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "text/html";
      const content = await response.text();

      onProgress?.({ stage: "extracting", progress: 50, message: "Parsing content" });

      // Process HTML content
      const document = await processDocument(content, contentType);
      onProgress?.({ stage: "extracting", progress: 100, message: "Content extraction complete" });

      // Update source config with crawl info
      await db
        .update(knowledgeSources)
        .set({
          sourceConfig: {
            url,
            lastCrawled: new Date().toISOString(),
            contentType,
          },
          updatedAt: new Date(),
        })
        .where(eq(knowledgeSources.id, sourceId));

      return await this.processContent(
        sourceId,
        document.content,
        options,
        startTime
      );
    } catch (error) {
      await this.handleProcessingError(sourceId, error);
      return {
        success: false,
        sourceId,
        chunksCreated: 0,
        totalTokens: 0,
        processingTimeMs: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Processing failed",
      };
    }
  }

  /**
   * Process raw text content
   */
  async processText(
    sourceId: string,
    content: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = performance.now();

    try {
      await this.updateSourceStatus(sourceId, "processing");
      return await this.processContent(sourceId, content, options, startTime);
    } catch (error) {
      await this.handleProcessingError(sourceId, error);
      return {
        success: false,
        sourceId,
        chunksCreated: 0,
        totalTokens: 0,
        processingTimeMs: performance.now() - startTime,
        error: error instanceof Error ? error.message : "Processing failed",
      };
    }
  }

  /**
   * Process content through chunking and embedding
   */
  private async processContent(
    sourceId: string,
    content: string,
    options: ProcessingOptions,
    startTime: number
  ): Promise<ProcessingResult> {
    const {
      onProgress,
      chunkingPreset = "qa",
      embedBatchSize = DEFAULT_EMBED_BATCH_SIZE,
      useQdrant = true, // Default to Qdrant
      storeInPostgres = false,
    } = options;

    // Get source info for companyId
    const [source] = await db
      .select({ companyId: knowledgeSources.companyId })
      .from(knowledgeSources)
      .where(eq(knowledgeSources.id, sourceId))
      .limit(1);

    if (!source) {
      throw new Error("Source not found");
    }

    // 2. Chunk the content
    onProgress?.({ stage: "chunking", progress: 0, message: "Splitting into chunks" });
    const chunkingOptions = CHUNKING_PRESETS[chunkingPreset];
    const chunks = chunkText(content, chunkingOptions);
    onProgress?.({
      stage: "chunking",
      progress: 100,
      message: `Created ${chunks.length} chunks`,
      totalChunks: chunks.length,
    });

    if (chunks.length === 0) {
      throw new Error("No chunks created from content");
    }

    // 3. Generate embeddings in batches
    onProgress?.({ stage: "embedding", progress: 0, message: "Generating embeddings" });
    const chunkContents = chunks.map((c) => c.content);
    const embeddings: number[][] = [];
    let totalTokens = 0;

    for (let i = 0; i < chunkContents.length; i += embedBatchSize) {
      const batch = chunkContents.slice(i, i + embedBatchSize);
      const batchResult = await this.embeddingService.embedBatch(batch);
      embeddings.push(...batchResult.embeddings.map((e) => e.embedding));
      totalTokens += batchResult.totalTokens;

      const progress = Math.round(((i + batch.length) / chunkContents.length) * 100);
      onProgress?.({
        stage: "embedding",
        progress,
        message: `Embedded ${i + batch.length}/${chunkContents.length} chunks`,
        chunksProcessed: i + batch.length,
        totalChunks: chunkContents.length,
      });
    }

    // 4. Store chunks in vector store
    onProgress?.({ stage: "storing", progress: 0, message: "Storing chunks in vector store" });

    let vectorStore: "qdrant" | "pgvector" = "qdrant";

    if (useQdrant) {
      // Store in Qdrant
      await this.storeChunksInQdrant(
        sourceId,
        source.companyId,
        chunks,
        embeddings,
        onProgress
      );
    } else {
      // Store in PostgreSQL (pgvector)
      vectorStore = "pgvector";
      await this.storeChunksInPostgres(
        sourceId,
        chunks,
        embeddings,
        onProgress
      );
    }

    // Optionally also store in PostgreSQL for backup
    if (useQdrant && storeInPostgres) {
      await this.storeChunksInPostgres(sourceId, chunks, embeddings);
    }

    // 5. Update source status
    await db
      .update(knowledgeSources)
      .set({
        status: "indexed",
        chunkCount: chunks.length,
        tokenCount: totalTokens,
        lastProcessedAt: new Date(),
        processingError: null,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeSources.id, sourceId));

    onProgress?.({ stage: "complete", progress: 100, message: "Processing complete" });

    return {
      success: true,
      sourceId,
      chunksCreated: chunks.length,
      totalTokens,
      processingTimeMs: performance.now() - startTime,
      vectorStore,
    };
  }

  /**
   * Store chunks in Qdrant vector database
   */
  private async storeChunksInQdrant(
    sourceId: string,
    companyId: string,
    chunks: TextChunk[],
    embeddings: number[][],
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<void> {
    // Delete existing chunks for this source
    await deleteChunksBySource(sourceId);

    // Prepare chunks for Qdrant
    const qdrantChunks: Array<{
      id: string;
      vector: number[];
      payload: VectorPayload;
    }> = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];
      if (!chunk || !embedding) continue;

      const chunkId = uuidv4();

      qdrantChunks.push({
        id: chunkId,
        vector: embedding,
        payload: {
          sourceId,
          companyId,
          content: chunk.content,
          chunkIndex: chunk.index,
          tokenCount: chunk.tokenEstimate,
          metadata: chunk.metadata,
        },
      });

      if (i % 20 === 0 || i === chunks.length - 1) {
        const progress = Math.round(((i + 1) / chunks.length) * 100);
        onProgress?.({
          stage: "storing",
          progress,
          message: `Preparing chunks: ${i + 1}/${chunks.length}`,
          chunksProcessed: i + 1,
          totalChunks: chunks.length,
        });
      }
    }

    // Store in Qdrant (batched internally)
    await storeChunks(qdrantChunks);

    onProgress?.({
      stage: "storing",
      progress: 100,
      message: `Stored ${chunks.length} chunks in Qdrant`,
      chunksProcessed: chunks.length,
      totalChunks: chunks.length,
    });
  }

  /**
   * Store chunks in PostgreSQL with pgvector
   */
  private async storeChunksInPostgres(
    sourceId: string,
    chunks: TextChunk[],
    embeddings: number[][],
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<void> {
    // Delete existing chunks for this source
    await db
      .delete(knowledgeChunks)
      .where(eq(knowledgeChunks.sourceId, sourceId));

    // Insert new chunks with embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];
      if (!chunk || !embedding) continue;

      const embeddingStr = `[${embedding.join(",")}]`;
      const metadataJson = JSON.stringify(chunk.metadata || {});

      await db.execute(sql`
        INSERT INTO chatapp_knowledge_chunks
        (id, source_id, chunk_index, content, token_count, embedding, metadata, created_at)
        VALUES (gen_random_uuid(), ${sourceId}, ${chunk.index}, ${chunk.content}, ${chunk.tokenEstimate}, ${embeddingStr}::vector, ${metadataJson}::jsonb, NOW())
      `);

      if (i % 10 === 0 || i === chunks.length - 1) {
        const progress = Math.round(((i + 1) / chunks.length) * 100);
        onProgress?.({
          stage: "storing",
          progress,
          message: `Stored ${i + 1}/${chunks.length} chunks`,
          chunksProcessed: i + 1,
          totalChunks: chunks.length,
        });
      }
    }
  }

  /**
   * Process a single FAQ item (add embedding)
   */
  async processFaq(
    faqId: string,
    options: { useQdrant?: boolean } = {}
  ): Promise<{ success: boolean; error?: string }> {
    const { useQdrant = true } = options;

    try {
      // Get FAQ
      const [faq] = await db
        .select()
        .from(faqItems)
        .where(eq(faqItems.id, faqId))
        .limit(1);

      if (!faq) {
        return { success: false, error: "FAQ not found" };
      }

      // Generate embedding for question + answer
      const text = `${faq.question}\n${faq.answer}`;
      const result = await this.embeddingService.embed(text);

      if (useQdrant) {
        // Store in Qdrant
        const payload: FaqPayload = {
          companyId: faq.companyId,
          question: faq.question,
          answer: faq.answer,
          category: faq.category,
        };

        await storeFaq(faqId, result.embedding, payload);
      }

      // Also update PostgreSQL for backup
      const embeddingStr = `[${result.embedding.join(",")}]`;
      await db.execute(sql`
        UPDATE chatapp_faq_items SET embedding = ${embeddingStr}::vector, updated_at = NOW() WHERE id = ${faqId}
      `);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process FAQ",
      };
    }
  }

  /**
   * Delete FAQ from both Qdrant and PostgreSQL
   */
  async deleteFaqEmbedding(faqId: string): Promise<void> {
    try {
      await deleteFaq(faqId);
    } catch {
      // Qdrant deletion failed, continue
    }

    // Remove embedding from PostgreSQL
    await db.execute(sql`
      UPDATE chatapp_faq_items SET embedding = NULL, updated_at = NOW() WHERE id = ${faqId}
    `);
  }

  /**
   * Reprocess all FAQs for a company
   */
  async reprocessFaqs(
    companyId: string,
    onProgress?: (progress: number, message: string) => void,
    options: { useQdrant?: boolean } = {}
  ): Promise<{ processed: number; failed: number }> {
    const faqs = await db
      .select({ id: faqItems.id })
      .from(faqItems)
      .where(eq(faqItems.companyId, companyId));

    let processed = 0;
    let failed = 0;

    for (let i = 0; i < faqs.length; i++) {
      const faq = faqs[i];
      if (!faq) continue;

      const result = await this.processFaq(faq.id, options);
      if (result.success) {
        processed++;
      } else {
        failed++;
      }

      onProgress?.(
        Math.round(((i + 1) / faqs.length) * 100),
        `Processed ${i + 1}/${faqs.length} FAQs`
      );
    }

    return { processed, failed };
  }

  /**
   * Delete all chunks for a source from both stores
   */
  async deleteSourceChunks(sourceId: string): Promise<void> {
    // Delete from Qdrant
    try {
      await deleteChunksBySource(sourceId);
    } catch {
      // Qdrant deletion failed, continue with PostgreSQL
    }

    // Delete from PostgreSQL
    await db
      .delete(knowledgeChunks)
      .where(eq(knowledgeChunks.sourceId, sourceId));
  }

  /**
   * Migrate chunks from PostgreSQL to Qdrant
   */
  async migrateToQdrant(
    sourceId: string,
    companyId: string,
    onProgress?: (progress: number, message: string) => void
  ): Promise<{ migrated: number; errors: number }> {
    let migrated = 0;
    let errors = 0;

    // Get all chunks from PostgreSQL
    const pgChunks = await db.execute<{
      id: string;
      content: string;
      chunk_index: number;
      token_count: number;
      metadata: Record<string, unknown>;
      embedding: number[];
    }>(sql`
      SELECT id, content, chunk_index, token_count, metadata, embedding::text
      FROM chatapp_knowledge_chunks
      WHERE source_id = ${sourceId}
      ORDER BY chunk_index
    `);

    const qdrantChunks: Array<{
      id: string;
      vector: number[];
      payload: VectorPayload;
    }> = [];

    for (let i = 0; i < pgChunks.length; i++) {
      const chunk = pgChunks[i];
      if (!chunk) continue;

      try {
        // Parse embedding from PostgreSQL format
        const embeddingStr = String(chunk.embedding);
        const embedding = JSON.parse(
          embeddingStr.replace(/^\[/, "[").replace(/\]$/, "]")
        ) as number[];

        qdrantChunks.push({
          id: chunk.id,
          vector: embedding,
          payload: {
            sourceId,
            companyId,
            content: chunk.content,
            chunkIndex: chunk.chunk_index,
            tokenCount: chunk.token_count,
            metadata: chunk.metadata,
          },
        });

        migrated++;
      } catch {
        errors++;
      }

      if (i % 20 === 0 || i === pgChunks.length - 1) {
        onProgress?.(
          Math.round(((i + 1) / pgChunks.length) * 100),
          `Migrating ${i + 1}/${pgChunks.length} chunks`
        );
      }
    }

    // Store in Qdrant
    if (qdrantChunks.length > 0) {
      await storeChunks(qdrantChunks);
    }

    return { migrated, errors };
  }

  /**
   * Update source status
   */
  private async updateSourceStatus(
    sourceId: string,
    status: "pending" | "processing" | "indexed" | "failed"
  ): Promise<void> {
    await db
      .update(knowledgeSources)
      .set({ status, updatedAt: new Date() })
      .where(eq(knowledgeSources.id, sourceId));
  }

  /**
   * Handle processing error
   */
  private async handleProcessingError(
    sourceId: string,
    error: unknown
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await db
      .update(knowledgeSources)
      .set({
        status: "failed",
        processingError: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeSources.id, sourceId));
  }
}

// Export singleton instance
let pipelineInstance: ProcessingPipeline | null = null;

export function getProcessingPipeline(): ProcessingPipeline {
  if (!pipelineInstance) {
    pipelineInstance = new ProcessingPipeline();
  }
  return pipelineInstance;
}

// Export convenience functions
export async function processKnowledgeFile(
  sourceId: string,
  fileBuffer: Buffer,
  fileType: string,
  fileName: string,
  options?: ProcessingOptions
): Promise<ProcessingResult> {
  const pipeline = getProcessingPipeline();
  return pipeline.processFile(sourceId, fileBuffer, fileType, fileName, options);
}

export async function processKnowledgeUrl(
  sourceId: string,
  url: string,
  options?: ProcessingOptions
): Promise<ProcessingResult> {
  const pipeline = getProcessingPipeline();
  return pipeline.processUrl(sourceId, url, options);
}

export async function processKnowledgeText(
  sourceId: string,
  content: string,
  options?: ProcessingOptions
): Promise<ProcessingResult> {
  const pipeline = getProcessingPipeline();
  return pipeline.processText(sourceId, content, options);
}

export async function migrateSourceToQdrant(
  sourceId: string,
  companyId: string,
  onProgress?: (progress: number, message: string) => void
): Promise<{ migrated: number; errors: number }> {
  const pipeline = getProcessingPipeline();
  return pipeline.migrateToQdrant(sourceId, companyId, onProgress);
}

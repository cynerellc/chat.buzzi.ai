/**
 * Knowledge Processing Pipeline
 *
 * Orchestrates the full knowledge ingestion process:
 * 1. Extract text from documents
 * 2. Split into chunks
 * 3. Generate embeddings
 * 4. Store in database with vector embeddings
 */

import { db } from "@/lib/db";
import { knowledgeSources, knowledgeChunks, faqItems } from "@/lib/db/schema/knowledge";
import { eq, sql } from "drizzle-orm";

import { processDocument } from "./document-processor";
import { chunkText, CHUNKING_PRESETS } from "./chunking-service";
import { getEmbeddingService } from "./embedding-service";

// Types
export interface ProcessingOptions {
  chunkingPreset?: keyof typeof CHUNKING_PRESETS;
  embedBatchSize?: number;
  onProgress?: (progress: ProcessingProgress) => void;
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
    const { onProgress, chunkingPreset = "qa", embedBatchSize = DEFAULT_EMBED_BATCH_SIZE } = options;

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

    // 4. Store chunks with embeddings
    onProgress?.({ stage: "storing", progress: 0, message: "Storing chunks in database" });

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
    };
  }

  /**
   * Process a single FAQ item (add embedding)
   */
  async processFaq(faqId: string): Promise<{ success: boolean; error?: string }> {
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
      const embeddingStr = `[${result.embedding.join(",")}]`;

      // Update FAQ with embedding
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
   * Reprocess all FAQs for a company
   */
  async reprocessFaqs(
    companyId: string,
    onProgress?: (progress: number, message: string) => void
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

      const result = await this.processFaq(faq.id);
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

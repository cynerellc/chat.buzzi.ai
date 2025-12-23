/**
 * Knowledge Module
 *
 * Exports all knowledge-related services and utilities
 */

// Document Processing
export {
  DocumentProcessor,
  processDocument,
  DocumentProcessingError,
  type ProcessedDocument,
  type DocumentMetadata,
  type DocumentSection,
  type ProcessorOptions,
} from "./document-processor";

// Text Chunking
export {
  ChunkingService,
  chunkText,
  CHUNKING_PRESETS,
  type TextChunk,
  type ChunkingOptions,
  type ChunkingStrategy,
  type ChunkMetadata,
} from "./chunking-service";

// Embeddings
export {
  EmbeddingService,
  getEmbeddingService,
  generateEmbedding,
  generateEmbeddings,
  EmbeddingError,
  type EmbeddingOptions,
  type EmbeddingModel,
  type EmbeddingResult,
  type BatchEmbeddingResult,
} from "./embedding-service";

// RAG Search
export {
  RagService,
  getRagService,
  searchKnowledge,
  buildKnowledgeContext,
  type SearchOptions,
  type SearchResult,
  type FaqSearchResult,
  type RagContext,
} from "./rag-service";

// Processing Pipeline
export {
  ProcessingPipeline,
  getProcessingPipeline,
  processKnowledgeFile,
  processKnowledgeUrl,
  processKnowledgeText,
  type ProcessingOptions,
  type ProcessingProgress,
  type ProcessingStage,
  type ProcessingResult,
} from "./processing-pipeline";

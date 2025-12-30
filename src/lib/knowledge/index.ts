/**
 * Knowledge Module
 *
 * Exports all knowledge-related services and utilities for RAG,
 * document processing, chunking, embeddings, and vector storage.
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

// Content Extractors
export {
  // Base
  BaseExtractor,
  ExtractionError,
  DEFAULT_EXTRACTOR_OPTIONS,
  type ExtractionResult,
  type ExtractionMetadata,
  type ContentSection,
  type ExtractorOptions,
  // Specific extractors
  PDFExtractor,
  pdfExtractor,
  DocxExtractor,
  docxExtractor,
  TextExtractor,
  textExtractor,
  HtmlExtractor,
  htmlExtractor,
  MarkdownExtractor,
  markdownExtractor,
  // Factory
  ExtractorFactory,
  extractContent,
  isSupported,
} from "./extractors";

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

// Qdrant Vector Store
export {
  QdrantService,
  getQdrantService,
  COLLECTIONS,
  VECTOR_DIMENSION,
  // Utility functions
  storeChunk,
  storeChunks,
  searchChunks,
  deleteChunksBySource,
  storeFaq,
  searchFaqs,
  deleteFaq,
  deleteFaqsByCompany,
  // Types
  type QdrantConfig,
  type VectorPayload,
  type FaqPayload,
  type SearchParams,
  type QdrantFilter,
  type QdrantCondition,
  type SearchHit,
} from "./qdrant-client";

// RAG Search
export {
  RagService,
  getRagService,
  searchKnowledge,
  buildKnowledgeContext,
  hybridSearchKnowledge,
  type SearchOptions,
  type SearchResult,
  type FaqSearchResult,
  type RagContext,
  type QueryExpansion,
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

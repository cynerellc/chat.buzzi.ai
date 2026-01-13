# Architecture: RAG & Knowledge Management

## Overview

This document details the Retrieval-Augmented Generation (RAG) and knowledge management architecture. The system enables companies to upload documents that are processed, chunked, embedded, and stored in Qdrant for semantic search during conversations. Qdrant provides a cost-effective solution with a free tier and supports multi-tenant collections with automatic offloading for idle agents (unused for 1+ hour).

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        RAG & KNOWLEDGE ARCHITECTURE                              │
└─────────────────────────────────────────────────────────────────────────────────┘

                         ┌───────────────────────┐
                         │    Document Upload    │
                         │   (Company Admin)     │
                         └───────────┬───────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          INGESTION PIPELINE                                      │
│                                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐│
│  │   Upload     │─▶│   Extract    │─▶│    Chunk     │─▶│      Embed           ││
│  │   to S3/R2   │  │   Content    │  │   Content    │  │   (OpenAI/Cohere)    ││
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────────┘│
│                                                                    │            │
│                                                                    ▼            │
│                                                         ┌──────────────────────┐│
│                                                         │   Store in Qdrant    ││
│                                                         │  + PostgreSQL Meta   ││
│                                                         └──────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          RETRIEVAL PIPELINE                                      │
│                                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐│
│  │   Query      │─▶│   Embed      │─▶│   Hybrid     │─▶│      Rerank          ││
│  │   Expansion  │  │   Query      │  │   Search     │  │   (Cross-encoder)    ││
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────────┘│
│                                                                    │            │
│                                                                    ▼            │
│                                                         ┌──────────────────────┐│
│                                                         │  Return to Agent     ││
│                                                         │  with Context        ││
│                                                         └──────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Document Ingestion Pipeline

### 2.1 Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       DOCUMENT INGESTION STAGES                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

   UPLOAD              EXTRACT             CHUNK              EMBED              STORE
     │                    │                  │                  │                  │
     ▼                    ▼                  ▼                  ▼                  ▼
┌─────────┐        ┌───────────┐      ┌───────────┐      ┌───────────┐      ┌───────────┐
│ Validate│───────▶│ Parse     │─────▶│ Semantic  │─────▶│ Generate  │─────▶│  Qdrant   │
│ & Store │        │ Content   │      │ Chunking  │      │ Embedding │      │ + Postgres│
└─────────┘        └───────────┘      └───────────┘      └───────────┘      └───────────┘
     │                    │                  │                  │                  │
     │                    │                  │                  │                  │
  • File type          • Text            • Overlap          • OpenAI           • Vector
  • Size limit         • Tables          • Boundaries       • ada-002          • Metadata
  • Virus scan         • Images (OCR)    • Hierarchy        • Batch            • File ref
  • Store S3           • Metadata        • Parent refs      • 1536 dims        • Indexes
```

### 2.2 BullMQ Job Queue

```typescript
// src/services/knowledge/queue.ts
import { Queue, Worker } from 'bullmq';

// Define job types
interface IndexingJob {
  fileId: string;
  companyId: string;
  categoryId: string;
  storagePath: string;
  mimeType: string;
  priority: 'high' | 'normal' | 'low';
}

// Create queue
export const indexingQueue = new Queue<IndexingJob>('knowledge-indexing', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

// Create worker
export const indexingWorker = new Worker<IndexingJob>(
  'knowledge-indexing',
  async (job) => {
    const { fileId, companyId, storagePath, mimeType } = job.data;

    // Update status to processing
    await db.update(knowledgeFiles)
      .set({ status: 'processing' })
      .where(eq(knowledgeFiles.id, fileId));

    try {
      // 1. Download file from storage
      const content = await storage.download(storagePath);

      // 2. Extract text content
      const extracted = await extractContent(content, mimeType);

      // 3. Chunk content
      const chunks = await chunkContent(extracted, {
        chunkSize: 500,
        chunkOverlap: 50,
        preserveBoundaries: true,
      });

      // 4. Generate embeddings (batched)
      const embeddings = await generateEmbeddings(chunks.map(c => c.text));

      // 5. Store in Qdrant
      await storeInQdrant(companyId, fileId, chunks, embeddings);

      // 6. Store chunk metadata in PostgreSQL
      await storeChunkMetadata(fileId, companyId, chunks);

      // 7. Update file status
      await db.update(knowledgeFiles)
        .set({
          status: 'indexed',
          chunkCount: chunks.length,
          indexedAt: new Date(),
        })
        .where(eq(knowledgeFiles.id, fileId));

      return { success: true, chunkCount: chunks.length };
    } catch (error) {
      // Update status to failed
      await db.update(knowledgeFiles)
        .set({
          status: 'failed',
          processingError: error.message,
        })
        .where(eq(knowledgeFiles.id, fileId));

      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 5,
    limiter: {
      max: 100,
      duration: 60000, // 100 jobs per minute
    },
  }
);
```

### 2.3 Content Extraction

```typescript
// src/services/knowledge/extractors/index.ts

interface ExtractedContent {
  text: string;
  metadata: {
    title?: string;
    author?: string;
    pageCount?: number;
    sections?: Section[];
    tables?: Table[];
    images?: ImageDescription[];
  };
}

export async function extractContent(
  content: Buffer,
  mimeType: string
): Promise<ExtractedContent> {
  const extractor = getExtractor(mimeType);
  return extractor.extract(content);
}

function getExtractor(mimeType: string): ContentExtractor {
  switch (mimeType) {
    case 'application/pdf':
      return new PDFExtractor();
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return new DocxExtractor();
    case 'text/html':
      return new HTMLExtractor();
    case 'text/csv':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return new SpreadsheetExtractor();
    case 'text/plain':
    case 'text/markdown':
      return new TextExtractor();
    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

// PDF Extractor with table and image handling
class PDFExtractor implements ContentExtractor {
  async extract(content: Buffer): Promise<ExtractedContent> {
    // Use pdf-parse for text extraction
    const pdfData = await pdfParse(content);

    // Extract tables using tabula-js or camelot
    const tables = await this.extractTables(content);

    // Extract images and generate descriptions
    const images = await this.extractAndDescribeImages(content);

    return {
      text: pdfData.text,
      metadata: {
        pageCount: pdfData.numpages,
        title: pdfData.info?.Title,
        author: pdfData.info?.Author,
        tables: tables.map(t => this.tableToText(t)),
        images: images,
      },
    };
  }

  private async extractAndDescribeImages(content: Buffer): Promise<ImageDescription[]> {
    // Extract images from PDF
    const images = await extractPdfImages(content);

    // Generate descriptions using vision model
    const descriptions = await Promise.all(
      images.map(async (img) => {
        const description = await generateImageDescription(img.buffer);
        return {
          page: img.page,
          description,
        };
      })
    );

    return descriptions;
  }
}
```

### 2.4 Semantic Chunking

```typescript
// src/services/knowledge/chunker.ts

interface ChunkOptions {
  chunkSize: number;      // Target chunk size in tokens
  chunkOverlap: number;   // Overlap between chunks
  preserveBoundaries: boolean; // Preserve paragraph/section boundaries
}

interface Chunk {
  text: string;
  index: number;
  metadata: {
    startOffset: number;
    endOffset: number;
    pageNumber?: number;
    sectionTitle?: string;
    parentChunkId?: string;
  };
}

export async function chunkContent(
  content: ExtractedContent,
  options: ChunkOptions
): Promise<Chunk[]> {
  const chunks: Chunk[] = [];

  // Split by semantic boundaries first
  const sections = splitBySemanticBoundaries(content.text);

  for (const section of sections) {
    // Check if section fits in one chunk
    const tokenCount = countTokens(section.text);

    if (tokenCount <= options.chunkSize) {
      chunks.push({
        text: section.text,
        index: chunks.length,
        metadata: {
          startOffset: section.startOffset,
          endOffset: section.endOffset,
          sectionTitle: section.title,
        },
      });
    } else {
      // Split large sections with overlap
      const subChunks = splitWithOverlap(section, options);
      chunks.push(...subChunks.map((c, i) => ({
        ...c,
        index: chunks.length + i,
      })));
    }
  }

  // Create parent-child relationships for hierarchical retrieval
  return createHierarchy(chunks);
}

function splitBySemanticBoundaries(text: string): Section[] {
  // Split by headers (# ## ###)
  // Split by double newlines (paragraphs)
  // Split by list boundaries
  // Preserve code blocks

  const sections: Section[] = [];
  const lines = text.split('\n');
  let currentSection: Section | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for header
    const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headerMatch) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        title: headerMatch[2],
        level: headerMatch[1].length,
        text: line,
        startOffset: 0, // Calculate actual offset
        endOffset: 0,
      };
    } else if (currentSection) {
      currentSection.text += '\n' + line;
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

function splitWithOverlap(section: Section, options: ChunkOptions): Chunk[] {
  const chunks: Chunk[] = [];
  const sentences = splitIntoSentences(section.text);

  let currentChunk = '';
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = countTokens(sentence);

    if (currentTokens + sentenceTokens > options.chunkSize) {
      // Save current chunk
      chunks.push({
        text: currentChunk.trim(),
        index: 0,
        metadata: {
          startOffset: 0,
          endOffset: 0,
          sectionTitle: section.title,
        },
      });

      // Start new chunk with overlap
      const overlapText = getOverlapText(currentChunk, options.chunkOverlap);
      currentChunk = overlapText + sentence;
      currentTokens = countTokens(currentChunk);
    } else {
      currentChunk += ' ' + sentence;
      currentTokens += sentenceTokens;
    }
  }

  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      index: 0,
      metadata: {
        startOffset: 0,
        endOffset: 0,
        sectionTitle: section.title,
      },
    });
  }

  return chunks;
}
```

### 2.5 Embedding Generation

```typescript
// src/services/knowledge/embeddings.ts

interface EmbeddingService {
  embed(texts: string[]): Promise<number[][]>;
  dimensions: number;
  model: string;
}

class OpenAIEmbeddingService implements EmbeddingService {
  private client: OpenAI;
  dimensions = 1536;
  model = 'text-embedding-ada-002';

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async embed(texts: string[]): Promise<number[][]> {
    // Batch requests (max 2048 texts per request)
    const batches = chunk(texts, 2048);
    const embeddings: number[][] = [];

    for (const batch of batches) {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: batch,
      });

      embeddings.push(...response.data.map(e => e.embedding));
    }

    return embeddings;
  }
}

// Alternative: Cohere for multilingual
class CohereEmbeddingService implements EmbeddingService {
  dimensions = 1024;
  model = 'embed-multilingual-v3.0';

  async embed(texts: string[]): Promise<number[][]> {
    const response = await cohere.embed({
      texts,
      model: this.model,
      inputType: 'search_document',
    });

    return response.embeddings;
  }
}

export async function generateEmbeddings(
  texts: string[],
  service: EmbeddingService = new OpenAIEmbeddingService()
): Promise<number[][]> {
  // Rate limiting and batching
  const embeddings: number[][] = [];
  const batchSize = 100;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchEmbeddings = await service.embed(batch);
    embeddings.push(...batchEmbeddings);

    // Rate limit: 3000 RPM for ada-002
    if (i + batchSize < texts.length) {
      await sleep(100);
    }
  }

  return embeddings;
}
```

---

## 3. Qdrant Storage

Qdrant is used as the vector database for storing embeddings. Key advantages:
- **Free tier** available for development and small deployments
- **Multi-tenant support** with collection-based isolation per company
- **Auto-offloading** for idle collections (agents unused for 1+ hour) to reduce memory usage

### 3.1 Collection Schema

```typescript
// src/services/knowledge/qdrant.ts
import { QdrantClient } from '@qdrant/js-client-rest';

const client = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

// Collection per company: company_{company_id}
export async function createCompanyCollection(companyId: string): Promise<void> {
  const collectionName = `company_${companyId.replace(/-/g, '_')}`;

  await client.createCollection(collectionName, {
    vectors: {
      size: 1536, // OpenAI ada-002 dimensions
      distance: 'Cosine',
    },
    // Enable on-disk storage for collections, auto-offload after 1hr idle
    optimizers_config: {
      memmap_threshold: 20000,
      indexing_threshold: 20000,
    },
    // Payload schema for filtering
    on_disk_payload: true,
  });

  // Create payload indexes for efficient filtering
  await client.createPayloadIndex(collectionName, {
    field_name: 'categoryId',
    field_schema: 'keyword',
  });

  await client.createPayloadIndex(collectionName, {
    field_name: 'fileId',
    field_schema: 'keyword',
  });

  await client.createPayloadIndex(collectionName, {
    field_name: 'chunkIndex',
    field_schema: 'integer',
  });
}
```

### 3.2 Storing Chunks

```typescript
// src/services/knowledge/storage.ts
import { v4 as uuidv4 } from 'uuid';

export async function storeInQdrant(
  companyId: string,
  fileId: string,
  chunks: Chunk[],
  embeddings: number[][]
): Promise<void> {
  const collectionName = `company_${companyId.replace(/-/g, '_')}`;

  // Prepare points for batch upsert
  const points = chunks.map((chunk, i) => ({
    id: uuidv4(),
    vector: embeddings[i],
    payload: {
      content: chunk.text,
      categoryId: chunk.categoryId,
      fileId: fileId,
      chunkIndex: chunk.index,
      sectionTitle: chunk.metadata.sectionTitle ?? '',
      pageNumber: chunk.metadata.pageNumber ?? 0,
      metadata: chunk.metadata,
    },
  }));

  // Batch upsert in chunks of 100 for performance
  const batchSize = 100;
  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize);
    await client.upsert(collectionName, {
      wait: true,
      points: batch,
    });
  }
}

export async function deleteFileChunks(
  companyId: string,
  fileId: string
): Promise<void> {
  const collectionName = `company_${companyId.replace(/-/g, '_')}`;

  await client.delete(collectionName, {
    wait: true,
    filter: {
      must: [
        {
          key: 'fileId',
          match: { value: fileId },
        },
      ],
    },
  });
}
```

---

## 4. Retrieval Pipeline

### 4.1 Retrieval Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          RETRIEVAL PIPELINE                                      │
└─────────────────────────────────────────────────────────────────────────────────┘

    User Query                 Query Expansion              Hybrid Search
        │                           │                            │
        ▼                           ▼                            ▼
┌───────────────┐          ┌───────────────┐           ┌──────────────────┐
│ "What is your │─────────▶│ Generate      │──────────▶│  Vector Search   │
│ return policy │          │ variations    │           │  (Semantic)      │
│ for shoes?"   │          │               │           │        +         │
└───────────────┘          │ • return      │           │  BM25 Search     │
                           │   policy      │           │  (Keyword)       │
                           │ • refund      │           │        +         │
                           │   shoes       │           │  Fusion          │
                           │ • exchange    │           └────────┬─────────┘
                           │   footwear    │                    │
                           └───────────────┘                    │
                                                                ▼
                                                     ┌──────────────────┐
                                                     │    Reranking     │
                                                     │  (Cross-encoder) │
                                                     └────────┬─────────┘
                                                              │
                                                              ▼
                                                     ┌──────────────────┐
                                                     │  Parent Context  │
                                                     │    Expansion     │
                                                     └────────┬─────────┘
                                                              │
                                                              ▼
                                                     ┌──────────────────┐
                                                     │  Return Results  │
                                                     │  to Agent        │
                                                     └──────────────────┘
```

### 4.2 RAG Service Implementation

```typescript
// src/services/knowledge/rag-service.ts

interface RAGSearchOptions {
  query: string;
  companyId: string;
  categoryIds?: string[];
  limit?: number;
  threshold?: number;
  useReranking?: boolean;
  expandContext?: boolean;
}

interface RAGResult {
  content: string;
  score: number;
  source: {
    fileId: string;
    fileName: string;
    categoryName: string;
    pageNumber?: number;
    sectionTitle?: string;
  };
}

export class RAGService {
  private qdrant: QdrantClient;
  private reranker: Reranker;

  async search(options: RAGSearchOptions): Promise<RAGResult[]> {
    const {
      query,
      companyId,
      categoryIds,
      limit = 5,
      threshold = 0.7,
      useReranking = true,
      expandContext = true,
    } = options;

    const collectionName = `company_${companyId.replace(/-/g, '_')}`;

    // 1. Query expansion for better recall
    const expandedQueries = await this.expandQuery(query);

    // 2. Hybrid search (vector + BM25)
    const results = await this.hybridSearch(
      collectionName,
      expandedQueries,
      categoryIds,
      limit * 3 // Get more for reranking
    );

    // 3. Rerank with cross-encoder
    let rankedResults = results;
    if (useReranking && results.length > 0) {
      rankedResults = await this.rerank(query, results);
    }

    // 4. Filter by threshold
    const filteredResults = rankedResults.filter(r => r.score >= threshold);

    // 5. Expand context with parent chunks
    let finalResults = filteredResults.slice(0, limit);
    if (expandContext) {
      finalResults = await this.expandWithParentContext(finalResults);
    }

    // 6. Fetch source metadata
    return this.enrichWithMetadata(finalResults);
  }

  private async expandQuery(query: string): Promise<string[]> {
    // Use LLM to generate query variations
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Generate 3 alternative phrasings of the following query for semantic search. Return as JSON array.',
        },
        { role: 'user', content: query },
      ],
      temperature: 0.3,
    });

    const variations = JSON.parse(response.choices[0].message.content);
    return [query, ...variations];
  }

  private async hybridSearch(
    collection: string,
    queries: string[],
    categoryIds?: string[],
    limit: number = 15
  ): Promise<SearchResult[]> {
    // Build filter for categories
    const filter = categoryIds?.length ? {
      should: categoryIds.map(id => ({
        key: 'categoryId',
        match: { value: id },
      })),
    } : undefined;

    // Execute searches for each query variation
    const allResults: Map<string, SearchResult> = new Map();

    for (const query of queries) {
      // Generate embedding for query
      const queryEmbedding = await this.generateQueryEmbedding(query);

      // Search Qdrant with vector similarity
      const result = await this.qdrant.search(collection, {
        vector: queryEmbedding,
        filter: filter,
        limit: limit,
        with_payload: true,
        score_threshold: 0.5,
      });

      // Merge results, keeping highest score
      for (const point of result) {
        const payload = point.payload as any;
        const id = `${payload.fileId}-${payload.chunkIndex}`;
        const existing = allResults.get(id);
        const score = point.score;

        if (!existing || score > existing.score) {
          allResults.set(id, {
            content: payload.content,
            score,
            fileId: payload.fileId,
            categoryId: payload.categoryId,
            chunkIndex: payload.chunkIndex,
            sectionTitle: payload.sectionTitle,
            pageNumber: payload.pageNumber,
            metadata: payload.metadata ?? {},
          });
        }
      }
    }

    // Sort by score and return
    return Array.from(allResults.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private async rerank(query: string, results: SearchResult[]): Promise<SearchResult[]> {
    // Use Cohere reranker or similar
    const reranked = await cohere.rerank({
      query,
      documents: results.map(r => r.content),
      model: 'rerank-english-v2.0',
      topN: results.length,
    });

    return reranked.results.map(r => ({
      ...results[r.index],
      score: r.relevanceScore,
    }));
  }

  private async expandWithParentContext(
    results: SearchResult[]
  ): Promise<SearchResult[]> {
    // For each result, fetch surrounding chunks for context
    const expanded: SearchResult[] = [];

    for (const result of results) {
      // Fetch parent/sibling chunks
      const siblings = await this.fetchSiblingChunks(
        result.fileId,
        result.chunkIndex,
        1 // Get 1 chunk before and after
      );

      // Combine into expanded context
      const combinedContent = siblings
        .sort((a, b) => a.chunkIndex - b.chunkIndex)
        .map(s => s.content)
        .join('\n\n');

      expanded.push({
        ...result,
        content: combinedContent,
      });
    }

    return expanded;
  }
}
```

### 4.3 RAG Tool for Agents

```typescript
// src/services/knowledge/rag-tool.ts

export const ragSearchTool: Tool = {
  name: 'search_knowledge_base',
  description: 'Search the company knowledge base for relevant information',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
      categories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional: specific categories to search',
      },
    },
    required: ['query'],
  },
  execute: async (params, context) => {
    const ragService = new RAGService();

    const results = await ragService.search({
      query: params.query,
      companyId: context.companyId,
      categoryIds: params.categories ?? context.agentCategoryIds,
      limit: 5,
      threshold: 0.7,
    });

    if (results.length === 0) {
      return {
        success: true,
        data: {
          found: false,
          message: 'No relevant information found in the knowledge base.',
        },
      };
    }

    // Format results for LLM consumption
    const formattedResults = results.map((r, i) => ({
      index: i + 1,
      content: r.content,
      source: `${r.source.fileName} (${r.source.categoryName})`,
      relevance: Math.round(r.score * 100) + '%',
    }));

    return {
      success: true,
      data: {
        found: true,
        results: formattedResults,
      },
    };
  },
};
```

---

## 5. Knowledge Category Management

### 5.1 Category Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        CATEGORY STRUCTURE                                        │
└─────────────────────────────────────────────────────────────────────────────────┘

Company: Acme Corp
│
├── Products
│   ├── Pricing
│   ├── Specifications
│   └── User Manuals
│
├── Policies
│   ├── Returns & Refunds
│   ├── Shipping
│   └── Privacy
│
├── FAQs
│   ├── General
│   ├── Technical Support
│   └── Billing
│
└── Internal (hidden from customers)
    ├── Sales Playbook
    └── Escalation Procedures
```

### 5.2 Agent-Category Assignment

```typescript
// Assign categories to agents
export async function assignCategoriesToAgent(
  agentId: string,
  categoryIds: string[]
): Promise<void> {
  // Delete existing assignments
  await db.delete(agentKnowledgeCategories)
    .where(eq(agentKnowledgeCategories.agentId, agentId));

  // Insert new assignments
  await db.insert(agentKnowledgeCategories)
    .values(categoryIds.map(categoryId => ({
      agentId,
      categoryId,
    })));
}

// Get agent's accessible categories
export async function getAgentCategories(agentId: string): Promise<string[]> {
  const assignments = await db.query.agentKnowledgeCategories.findMany({
    where: eq(agentKnowledgeCategories.agentId, agentId),
  });

  return assignments.map(a => a.categoryId);
}
```

---

## 6. File Processing Status

### 6.1 Status Dashboard Data

```typescript
// src/services/knowledge/status.ts

interface FileProcessingStatus {
  fileId: string;
  filename: string;
  status: 'pending' | 'processing' | 'indexed' | 'failed';
  progress?: number;
  chunkCount?: number;
  error?: string;
  createdAt: Date;
  indexedAt?: Date;
}

export async function getProcessingStatus(
  companyId: string
): Promise<FileProcessingStatus[]> {
  const files = await db.query.knowledgeFiles.findMany({
    where: eq(knowledgeFiles.companyId, companyId),
    orderBy: desc(knowledgeFiles.createdAt),
  });

  // Get queue status for pending/processing files
  const queueStatus = await getQueueStatus(files.map(f => f.id));

  return files.map(file => ({
    fileId: file.id,
    filename: file.originalFilename,
    status: file.status,
    progress: queueStatus.get(file.id)?.progress,
    chunkCount: file.chunkCount,
    error: file.processingError,
    createdAt: file.createdAt,
    indexedAt: file.indexedAt,
  }));
}
```

---

## 7. Performance Optimization

### 7.1 Caching Strategy

```typescript
// src/services/knowledge/cache.ts

// Cache frequently accessed search results
const searchCache = new LRUCache<string, RAGResult[]>({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes
});

export async function cachedSearch(
  options: RAGSearchOptions
): Promise<RAGResult[]> {
  const cacheKey = createCacheKey(options);

  // Check cache
  const cached = searchCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Perform search
  const results = await ragService.search(options);

  // Cache results
  searchCache.set(cacheKey, results);

  return results;
}

function createCacheKey(options: RAGSearchOptions): string {
  return `${options.companyId}:${options.query}:${options.categoryIds?.join(',')}`;
}
```

### 7.2 Batch Embedding Optimization

```typescript
// Batch embedding requests across multiple file uploads
const embeddingBatcher = new Batcher<string, number[]>({
  maxBatchSize: 2000,
  maxWaitMs: 100,
  async processBatch(texts: string[]): Promise<number[][]> {
    return embeddingService.embed(texts);
  },
});

export async function getEmbedding(text: string): Promise<number[]> {
  return embeddingBatcher.add(text);
}
```

---

## Related Documents

- [Architecture Overview](./architecture-overview.md)
- [Database Schema](./database-schema.md)
- [Agent Framework Architecture](./architecture-agent-framework.md)
- [Requirements Document](./requirement.v2.md)

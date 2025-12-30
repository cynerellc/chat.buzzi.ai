/**
 * Qdrant Vector Database Client
 *
 * Provides connection and operations for Qdrant vector storage.
 * Replaces pgvector for vector similarity search.
 */

import { QdrantClient } from "@qdrant/js-client-rest";

// Types
export interface QdrantConfig {
  url: string;
  apiKey?: string;
}

export interface VectorPayload {
  sourceId: string;
  companyId: string;
  category?: string | null;
  content: string;
  chunkIndex: number;
  tokenCount: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown; // Index signature for compatibility
}

export interface FaqPayload {
  companyId: string;
  question: string;
  answer: string;
  category?: string | null;
  [key: string]: unknown; // Index signature for compatibility
}

export interface SearchParams {
  vector: number[];
  collectionName: string;
  limit: number;
  filter?: QdrantFilter;
  scoreThreshold?: number;
  withPayload?: boolean;
}

export interface QdrantFilter {
  must?: QdrantCondition[];
  should?: QdrantCondition[];
  must_not?: QdrantCondition[];
}

export interface QdrantCondition {
  key: string;
  match?: { value: string | number | boolean };
  range?: { gte?: number; lte?: number; gt?: number; lt?: number };
}

export interface SearchHit<T = Record<string, unknown>> {
  id: string | number;
  score: number;
  payload?: T;
}

// Collection names
export const COLLECTIONS = {
  KNOWLEDGE_CHUNKS: "knowledge_chunks",
  FAQ_ITEMS: "faq_items",
} as const;

// Vector dimensions (must match embedding model)
export const VECTOR_DIMENSION = 1536; // text-embedding-3-small default

/**
 * Qdrant Service Class
 */
export class QdrantService {
  private client: QdrantClient;
  private initialized: boolean = false;

  constructor(config?: Partial<QdrantConfig>) {
    const url = config?.url || process.env.QDRANT_ENDPOINT;
    const apiKey = config?.apiKey || process.env.QDRANT_API_KEY;

    if (!url) {
      throw new Error(
        "QDRANT_ENDPOINT environment variable is required"
      );
    }

    this.client = new QdrantClient({
      url,
      apiKey,
    });
  }

  /**
   * Initialize collections if they don't exist
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.ensureCollection(COLLECTIONS.KNOWLEDGE_CHUNKS),
      this.ensureCollection(COLLECTIONS.FAQ_ITEMS),
    ]);

    this.initialized = true;
  }

  /**
   * Ensure a collection exists with proper configuration
   */
  private async ensureCollection(collectionName: string): Promise<void> {
    try {
      const exists = await this.client.collectionExists(collectionName);

      if (!exists.exists) {
        await this.client.createCollection(collectionName, {
          vectors: {
            size: VECTOR_DIMENSION,
            distance: "Cosine",
          },
          optimizers_config: {
            default_segment_number: 2,
            memmap_threshold: 20000,
          },
          replication_factor: 1,
        });

        // Create indexes for filtering
        await this.createIndexes(collectionName);
      }
    } catch (error) {
      // Collection might already exist, check if it's accessible
      const collections = await this.client.getCollections();
      const found = collections.collections.find(
        (c) => c.name === collectionName
      );
      if (!found) {
        throw new Error(
          `Failed to create or access collection ${collectionName}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }
  }

  /**
   * Create payload indexes for efficient filtering
   */
  private async createIndexes(collectionName: string): Promise<void> {
    const indexes = ["companyId", "sourceId", "category"];

    for (const fieldName of indexes) {
      try {
        await this.client.createPayloadIndex(collectionName, {
          field_name: fieldName,
          field_schema: "keyword",
        });
      } catch {
        // Index might already exist
      }
    }
  }

  /**
   * Upsert vectors into a collection
   */
  async upsertVectors<T extends Record<string, unknown>>(
    collectionName: string,
    points: Array<{
      id: string;
      vector: number[];
      payload: T;
    }>
  ): Promise<void> {
    if (points.length === 0) return;

    await this.initialize();

    // Upsert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      await this.client.upsert(collectionName, {
        wait: true,
        points: batch,
      });
    }
  }

  /**
   * Search for similar vectors
   */
  async search<T = Record<string, unknown>>(
    params: SearchParams
  ): Promise<SearchHit<T>[]> {
    await this.initialize();

    const result = await this.client.search(params.collectionName, {
      vector: params.vector,
      limit: params.limit,
      filter: params.filter,
      score_threshold: params.scoreThreshold,
      with_payload: params.withPayload ?? true,
    });

    return result.map((hit) => ({
      id: hit.id,
      score: hit.score,
      payload: hit.payload as T | undefined,
    }));
  }

  /**
   * Delete vectors by filter
   */
  async deleteByFilter(
    collectionName: string,
    filter: QdrantFilter
  ): Promise<void> {
    await this.initialize();

    await this.client.delete(collectionName, {
      wait: true,
      filter,
    });
  }

  /**
   * Delete vectors by IDs
   */
  async deleteByIds(
    collectionName: string,
    ids: string[]
  ): Promise<void> {
    await this.initialize();

    await this.client.delete(collectionName, {
      wait: true,
      points: ids,
    });
  }

  /**
   * Get vectors by IDs
   */
  async getByIds<T = Record<string, unknown>>(
    collectionName: string,
    ids: string[]
  ): Promise<SearchHit<T>[]> {
    await this.initialize();

    const result = await this.client.retrieve(collectionName, {
      ids,
      with_payload: true,
      with_vector: false,
    });

    return result.map((point) => ({
      id: point.id,
      score: 1, // No score for direct retrieval
      payload: point.payload as T | undefined,
    }));
  }

  /**
   * Count vectors matching a filter
   */
  async count(
    collectionName: string,
    filter?: QdrantFilter
  ): Promise<number> {
    await this.initialize();

    const result = await this.client.count(collectionName, {
      filter,
      exact: true,
    });

    return result.count;
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(collectionName: string): Promise<{
    vectorCount: number;
    status: string;
  }> {
    await this.initialize();

    const info = await this.client.getCollection(collectionName);

    return {
      vectorCount: info.points_count ?? 0,
      status: info.status,
    };
  }

  /**
   * Scroll through vectors with pagination
   */
  async scroll<T = Record<string, unknown>>(
    collectionName: string,
    options: {
      filter?: QdrantFilter;
      limit?: number;
      offset?: string | number | null;
      withPayload?: boolean;
      withVector?: boolean;
    } = {}
  ): Promise<{
    points: SearchHit<T>[];
    nextOffset?: string | number | null;
  }> {
    await this.initialize();

    const result = await this.client.scroll(collectionName, {
      filter: options.filter,
      limit: options.limit ?? 100,
      offset: options.offset ?? undefined,
      with_payload: options.withPayload ?? true,
      with_vector: options.withVector ?? false,
    });

    return {
      points: result.points.map((point) => ({
        id: point.id,
        score: 1,
        payload: point.payload as T | undefined,
      })),
      nextOffset: result.next_page_offset as string | number | null | undefined,
    };
  }

  /**
   * Get underlying Qdrant client for advanced operations
   */
  getClient(): QdrantClient {
    return this.client;
  }
}

// Singleton instance
let qdrantInstance: QdrantService | null = null;

export function getQdrantService(config?: Partial<QdrantConfig>): QdrantService {
  if (!qdrantInstance || config) {
    qdrantInstance = new QdrantService(config);
  }
  return qdrantInstance;
}

// Utility functions for common operations

/**
 * Store knowledge chunk in Qdrant
 */
export async function storeChunk(
  id: string,
  vector: number[],
  payload: VectorPayload
): Promise<void> {
  const service = getQdrantService();
  await service.upsertVectors(COLLECTIONS.KNOWLEDGE_CHUNKS, [
    { id, vector, payload },
  ]);
}

/**
 * Store multiple knowledge chunks in Qdrant
 */
export async function storeChunks(
  chunks: Array<{ id: string; vector: number[]; payload: VectorPayload }>
): Promise<void> {
  const service = getQdrantService();
  await service.upsertVectors(COLLECTIONS.KNOWLEDGE_CHUNKS, chunks);
}

/**
 * Search knowledge chunks
 */
export async function searchChunks(
  vector: number[],
  companyId: string,
  options: {
    limit?: number;
    sourceIds?: string[];
    categories?: string[];
    scoreThreshold?: number;
  } = {}
): Promise<SearchHit<VectorPayload>[]> {
  const service = getQdrantService();

  const mustConditions: QdrantCondition[] = [
    { key: "companyId", match: { value: companyId } },
  ];

  // Filter by category names if provided
  if (options.categories && options.categories.length > 0) {
    // Create a should clause within must to match any of the categories
    const categoryFilter: QdrantFilter = {
      should: options.categories.map((category) => ({
        key: "category",
        match: { value: category },
      })),
    };
    // Wrap in a nested filter for proper AND behavior with company filter
    return service.search<VectorPayload>({
      collectionName: COLLECTIONS.KNOWLEDGE_CHUNKS,
      vector,
      limit: options.limit ?? 10,
      filter: {
        must: mustConditions,
        should: categoryFilter.should,
      },
      scoreThreshold: options.scoreThreshold ?? 0.7,
    });
  }

  const filter: QdrantFilter = {
    must: mustConditions,
  };

  if (options.sourceIds && options.sourceIds.length > 0) {
    filter.should = options.sourceIds.map((sourceId) => ({
      key: "sourceId",
      match: { value: sourceId },
    }));
  }

  return service.search<VectorPayload>({
    collectionName: COLLECTIONS.KNOWLEDGE_CHUNKS,
    vector,
    limit: options.limit ?? 10,
    filter,
    scoreThreshold: options.scoreThreshold ?? 0.7,
  });
}

/**
 * Delete chunks by source ID
 */
export async function deleteChunksBySource(sourceId: string): Promise<void> {
  const service = getQdrantService();
  await service.deleteByFilter(COLLECTIONS.KNOWLEDGE_CHUNKS, {
    must: [{ key: "sourceId", match: { value: sourceId } }],
  });
}

/**
 * Store FAQ in Qdrant
 */
export async function storeFaq(
  id: string,
  vector: number[],
  payload: FaqPayload
): Promise<void> {
  const service = getQdrantService();
  await service.upsertVectors(COLLECTIONS.FAQ_ITEMS, [{ id, vector, payload }]);
}

/**
 * Search FAQs
 */
export async function searchFaqs(
  vector: number[],
  companyId: string,
  options: {
    limit?: number;
    scoreThreshold?: number;
  } = {}
): Promise<SearchHit<FaqPayload>[]> {
  const service = getQdrantService();

  return service.search<FaqPayload>({
    collectionName: COLLECTIONS.FAQ_ITEMS,
    vector,
    limit: options.limit ?? 5,
    filter: {
      must: [{ key: "companyId", match: { value: companyId } }],
    },
    scoreThreshold: options.scoreThreshold ?? 0.75,
  });
}

/**
 * Delete FAQ by ID
 */
export async function deleteFaq(id: string): Promise<void> {
  const service = getQdrantService();
  await service.deleteByIds(COLLECTIONS.FAQ_ITEMS, [id]);
}

/**
 * Delete all FAQs for a company
 */
export async function deleteFaqsByCompany(companyId: string): Promise<void> {
  const service = getQdrantService();
  await service.deleteByFilter(COLLECTIONS.FAQ_ITEMS, {
    must: [{ key: "companyId", match: { value: companyId } }],
  });
}

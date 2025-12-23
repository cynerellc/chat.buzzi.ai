/**
 * Chunking Service
 *
 * Splits documents into smaller chunks for embedding and retrieval.
 * Supports multiple chunking strategies:
 * - Fixed size with overlap
 * - Sentence-based
 * - Paragraph-based
 * - Semantic (heading-based)
 * - Semantic NLP (topic boundary detection)
 */

// Types
export interface ChunkingOptions {
  strategy: ChunkingStrategy;
  chunkSize: number; // Target characters per chunk
  chunkOverlap: number; // Characters to overlap between chunks
  minChunkSize?: number; // Minimum chunk size (skip smaller chunks)
  maxChunkSize?: number; // Maximum chunk size (split larger chunks)
  preserveSentences?: boolean; // Try not to split mid-sentence
  preserveParagraphs?: boolean; // Try not to split mid-paragraph
  semanticThreshold?: number; // Threshold for semantic boundary detection (0-1)
  includeParentContext?: boolean; // Include parent chunk reference for hierarchical retrieval
}

export type ChunkingStrategy =
  | "fixed"
  | "sentence"
  | "paragraph"
  | "semantic"
  | "semantic_nlp"; // Topic-based chunking using NLP heuristics

export interface TextChunk {
  content: string;
  index: number;
  startChar: number;
  endChar: number;
  tokenEstimate: number;
  metadata?: ChunkMetadata;
}

export interface ChunkMetadata {
  sectionTitle?: string;
  pageNumber?: number;
  paragraphIndex?: number;
  parentChunkId?: string; // Reference to parent chunk for hierarchical retrieval
  siblingChunkIds?: string[]; // References to adjacent chunks
  topicKeywords?: string[]; // Key terms extracted from chunk
  semanticScore?: number; // Semantic coherence score
  [key: string]: unknown; // Index signature for compatibility
}

// Default options
const DEFAULT_OPTIONS: ChunkingOptions = {
  strategy: "paragraph",
  chunkSize: 1000,
  chunkOverlap: 200,
  minChunkSize: 100,
  maxChunkSize: 2000,
  preserveSentences: true,
  preserveParagraphs: true,
  semanticThreshold: 0.5,
  includeParentContext: true,
};

// Paragraph boundary regex
const PARAGRAPH_REGEX = /\n\n+/g;

/**
 * Main chunking service class
 */
export class ChunkingService {
  private options: ChunkingOptions;

  constructor(options: Partial<ChunkingOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Split text into chunks
   */
  chunk(text: string): TextChunk[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const normalizedText = this.normalizeText(text);

    switch (this.options.strategy) {
      case "sentence":
        return this.chunkBySentence(normalizedText);
      case "paragraph":
        return this.chunkByParagraph(normalizedText);
      case "semantic":
        return this.chunkSemantic(normalizedText);
      case "semantic_nlp":
        return this.chunkSemanticNlp(normalizedText);
      case "fixed":
      default:
        return this.chunkFixed(normalizedText);
    }
  }

  /**
   * Fixed-size chunking with overlap
   */
  private chunkFixed(text: string): TextChunk[] {
    const chunks: TextChunk[] = [];
    let position = 0;
    let index = 0;

    while (position < text.length) {
      let endPosition = position + this.options.chunkSize;

      // Try to find a good break point if preserving sentences
      if (this.options.preserveSentences && endPosition < text.length) {
        const searchStart = Math.max(
          position + this.options.chunkSize - 200,
          position
        );
        const searchEnd = Math.min(
          position + this.options.chunkSize + 200,
          text.length
        );
        const searchText = text.slice(searchStart, searchEnd);

        // Find sentence boundary
        const sentenceMatch = this.findLastSentenceBoundary(
          searchText,
          this.options.chunkSize - (searchStart - position)
        );

        if (sentenceMatch !== -1) {
          endPosition = searchStart + sentenceMatch;
        }
      }

      // Ensure we don't exceed maxChunkSize
      if (
        this.options.maxChunkSize &&
        endPosition - position > this.options.maxChunkSize
      ) {
        endPosition = position + this.options.maxChunkSize;
      }

      // Extract chunk content
      const content = text.slice(position, endPosition).trim();

      // Skip if too small
      if (
        this.options.minChunkSize &&
        content.length < this.options.minChunkSize
      ) {
        // Combine with previous chunk if possible
        const lastChunk = chunks[chunks.length - 1];
        if (lastChunk) {
          lastChunk.content += " " + content;
          lastChunk.endChar = endPosition;
          lastChunk.tokenEstimate = this.estimateTokens(lastChunk.content);
        }
        position = endPosition;
        continue;
      }

      chunks.push({
        content,
        index: index++,
        startChar: position,
        endChar: endPosition,
        tokenEstimate: this.estimateTokens(content),
      });

      // Move position with overlap
      const lastAddedChunk = chunks[chunks.length - 1];
      position = endPosition - this.options.chunkOverlap;
      if (lastAddedChunk && position <= lastAddedChunk.startChar) {
        position = endPosition; // Prevent infinite loop
      }
    }

    return chunks;
  }

  /**
   * Sentence-based chunking
   */
  private chunkBySentence(text: string): TextChunk[] {
    // Split into sentences
    const sentences = this.splitIntoSentences(text);
    const chunks: TextChunk[] = [];
    let currentChunk = "";
    let chunkStart = 0;
    let charPosition = 0;
    let index = 0;

    for (const sentence of sentences) {
      const sentenceLength = sentence.length;

      // If adding this sentence would exceed chunk size, save current chunk
      if (
        currentChunk.length > 0 &&
        currentChunk.length + sentenceLength > this.options.chunkSize
      ) {
        chunks.push({
          content: currentChunk.trim(),
          index: index++,
          startChar: chunkStart,
          endChar: charPosition,
          tokenEstimate: this.estimateTokens(currentChunk),
        });

        // Start new chunk with overlap
        const overlapStart = this.findOverlapStart(currentChunk);
        currentChunk = currentChunk.slice(overlapStart) + " ";
        chunkStart = charPosition - (currentChunk.length - 1);
      }

      currentChunk += sentence + " ";
      charPosition += sentenceLength + 1;
    }

    // Add remaining chunk
    if (currentChunk.trim().length >= (this.options.minChunkSize || 0)) {
      chunks.push({
        content: currentChunk.trim(),
        index: index++,
        startChar: chunkStart,
        endChar: charPosition,
        tokenEstimate: this.estimateTokens(currentChunk),
      });
    }

    return chunks;
  }

  /**
   * Paragraph-based chunking
   */
  private chunkByParagraph(text: string): TextChunk[] {
    // Split into paragraphs
    const paragraphs = text.split(PARAGRAPH_REGEX).filter((p) => p.trim());
    const chunks: TextChunk[] = [];
    let currentChunk = "";
    let chunkStart = 0;
    let charPosition = 0;
    let index = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const rawParagraph = paragraphs[i];
      if (!rawParagraph) continue;
      const paragraph = rawParagraph.trim();
      const paragraphLength = paragraph.length;

      // If single paragraph exceeds chunk size, use sentence chunking
      if (paragraphLength > this.options.chunkSize) {
        // Save current chunk first
        if (
          currentChunk.trim().length >= (this.options.minChunkSize || 0)
        ) {
          chunks.push({
            content: currentChunk.trim(),
            index: index++,
            startChar: chunkStart,
            endChar: charPosition,
            tokenEstimate: this.estimateTokens(currentChunk),
            metadata: { paragraphIndex: i },
          });
        }

        // Split large paragraph by sentences
        const subChunks = this.chunkBySentence(paragraph);
        for (const subChunk of subChunks) {
          chunks.push({
            ...subChunk,
            index: index++,
            startChar: charPosition + subChunk.startChar,
            endChar: charPosition + subChunk.endChar,
            metadata: { paragraphIndex: i },
          });
        }

        currentChunk = "";
        chunkStart = charPosition + paragraphLength + 2; // +2 for \n\n
        charPosition = chunkStart;
        continue;
      }

      // If adding this paragraph would exceed chunk size
      if (
        currentChunk.length > 0 &&
        currentChunk.length + paragraphLength + 2 > this.options.chunkSize
      ) {
        chunks.push({
          content: currentChunk.trim(),
          index: index++,
          startChar: chunkStart,
          endChar: charPosition,
          tokenEstimate: this.estimateTokens(currentChunk),
        });

        currentChunk = "";
        chunkStart = charPosition;
      }

      currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
      charPosition += paragraphLength + 2;
    }

    // Add remaining chunk
    if (currentChunk.trim().length >= (this.options.minChunkSize || 0)) {
      chunks.push({
        content: currentChunk.trim(),
        index: index++,
        startChar: chunkStart,
        endChar: charPosition,
        tokenEstimate: this.estimateTokens(currentChunk),
      });
    }

    return chunks;
  }

  /**
   * Semantic chunking based on document structure
   */
  private chunkSemantic(text: string): TextChunk[] {
    // Try to detect headings and section boundaries
    const headingRegex = /^(?:#{1,6}\s+.+|[A-Z][A-Za-z\s]+:)\s*$/gm;
    const chunks: TextChunk[] = [];
    let chunkIndex = 0;
    let match;

    const headings: Array<{ title: string; index: number }> = [];
    while ((match = headingRegex.exec(text)) !== null) {
      headings.push({
        title: match[0].replace(/^#+\s*/, "").trim(),
        index: match.index,
      });
    }

    // If no headings found, fall back to paragraph chunking
    if (headings.length === 0) {
      return this.chunkByParagraph(text);
    }

    // Add content before first heading
    const firstHeading = headings[0];
    if (firstHeading && firstHeading.index > 0) {
      const introContent = text.slice(0, firstHeading.index).trim();
      if (introContent.length >= (this.options.minChunkSize || 0)) {
        chunks.push({
          content: introContent,
          index: chunkIndex++,
          startChar: 0,
          endChar: firstHeading.index,
          tokenEstimate: this.estimateTokens(introContent),
        });
      }
    }

    // Process each section
    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      if (!heading) continue;

      const nextHeading = headings[i + 1];
      const sectionEnd = nextHeading ? nextHeading.index : text.length;
      const sectionContent = text.slice(heading.index, sectionEnd).trim();

      // If section is too large, split it
      if (sectionContent.length > this.options.chunkSize) {
        const subChunks = this.chunkByParagraph(sectionContent);
        for (const subChunk of subChunks) {
          chunks.push({
            ...subChunk,
            index: chunkIndex++,
            startChar: heading.index + subChunk.startChar,
            endChar: heading.index + subChunk.endChar,
            metadata: { sectionTitle: heading.title },
          });
        }
      } else if (sectionContent.length >= (this.options.minChunkSize || 0)) {
        chunks.push({
          content: sectionContent,
          index: chunkIndex++,
          startChar: heading.index,
          endChar: sectionEnd,
          tokenEstimate: this.estimateTokens(sectionContent),
          metadata: { sectionTitle: heading.title },
        });
      }
    }

    return chunks;
  }

  /**
   * Semantic NLP-based chunking
   * Uses topic coherence and transition detection to find natural breakpoints
   */
  private chunkSemanticNlp(text: string): TextChunk[] {
    const sentences = this.splitIntoSentences(text);
    if (sentences.length === 0) return [];

    const chunks: TextChunk[] = [];
    let currentChunk: string[] = [];
    let currentTopicKeywords = new Set<string>();
    let chunkIndex = 0;
    let charPosition = 0;
    let chunkStart = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      if (!sentence) continue;

      const sentenceKeywords = this.extractKeywords(sentence);
      const overlap = this.calculateKeywordOverlap(
        currentTopicKeywords,
        sentenceKeywords
      );

      // Determine if we should start a new chunk
      const shouldSplit =
        currentChunk.length > 0 &&
        (currentChunk.join(" ").length >= this.options.chunkSize ||
          (overlap < (this.options.semanticThreshold ?? 0.5) &&
            currentChunk.join(" ").length >= (this.options.minChunkSize ?? 100)) ||
          this.detectTopicTransition(currentChunk, sentence));

      if (shouldSplit) {
        const chunkContent = currentChunk.join(" ").trim();
        if (chunkContent.length >= (this.options.minChunkSize ?? 100)) {
          const topicKeywords = this.getTopKeywords(currentTopicKeywords, 5);
          chunks.push({
            content: chunkContent,
            index: chunkIndex++,
            startChar: chunkStart,
            endChar: charPosition,
            tokenEstimate: this.estimateTokens(chunkContent),
            metadata: {
              topicKeywords,
              semanticScore: this.calculateSemanticCoherence(currentChunk),
            },
          });
        }

        // Start new chunk with overlap
        const overlapSentences = this.getOverlapSentences(
          currentChunk,
          this.options.chunkOverlap
        );
        currentChunk = [...overlapSentences];
        currentTopicKeywords = new Set<string>();
        for (const s of overlapSentences) {
          for (const k of this.extractKeywords(s)) {
            currentTopicKeywords.add(k);
          }
        }
        chunkStart = charPosition - overlapSentences.join(" ").length;
      }

      // Add sentence to current chunk
      currentChunk.push(sentence);
      for (const k of sentenceKeywords) {
        currentTopicKeywords.add(k);
      }
      charPosition += sentence.length + 1;
    }

    // Add final chunk
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join(" ").trim();
      if (chunkContent.length >= (this.options.minChunkSize ?? 0)) {
        const topicKeywords = this.getTopKeywords(currentTopicKeywords, 5);
        chunks.push({
          content: chunkContent,
          index: chunkIndex,
          startChar: chunkStart,
          endChar: charPosition,
          tokenEstimate: this.estimateTokens(chunkContent),
          metadata: {
            topicKeywords,
            semanticScore: this.calculateSemanticCoherence(currentChunk),
          },
        });
      }
    }

    // Add sibling references if enabled
    if (this.options.includeParentContext) {
      this.addSiblingReferences(chunks);
    }

    return chunks;
  }

  /**
   * Extract keywords from text using basic NLP heuristics
   */
  private extractKeywords(text: string): Set<string> {
    const stopWords = new Set([
      "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
      "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
      "be", "have", "has", "had", "do", "does", "did", "will", "would", "could",
      "should", "may", "might", "must", "shall", "can", "need", "dare", "ought",
      "used", "this", "that", "these", "those", "i", "you", "he", "she", "it",
      "we", "they", "what", "which", "who", "whom", "whose", "where", "when",
      "why", "how", "all", "each", "every", "both", "few", "more", "most",
      "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so",
      "than", "too", "very", "just", "also", "now", "here", "there", "then",
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    return new Set(words);
  }

  /**
   * Calculate overlap between two keyword sets
   */
  private calculateKeywordOverlap(
    set1: Set<string>,
    set2: Set<string>
  ): number {
    if (set1.size === 0 || set2.size === 0) return 0;

    let intersection = 0;
    for (const keyword of set2) {
      if (set1.has(keyword)) {
        intersection++;
      }
    }

    return intersection / Math.min(set1.size, set2.size);
  }

  /**
   * Detect topic transition between chunk and new sentence
   */
  private detectTopicTransition(
    currentChunk: string[],
    newSentence: string
  ): boolean {
    // Check for explicit transition markers
    const transitionMarkers = [
      /^(however|nevertheless|on the other hand|in contrast|alternatively)/i,
      /^(furthermore|moreover|additionally|in addition|also)/i,
      /^(firstly|secondly|thirdly|finally|lastly|next)/i,
      /^(for example|for instance|such as|specifically)/i,
      /^(in conclusion|to summarize|in summary|overall)/i,
      /^(meanwhile|subsequently|consequently|therefore|thus)/i,
    ];

    for (const marker of transitionMarkers) {
      if (marker.test(newSentence.trim())) {
        return true;
      }
    }

    // Check for significant topic shift using keyword overlap
    const lastSentences = currentChunk.slice(-3);
    const recentKeywords = new Set<string>();
    for (const s of lastSentences) {
      for (const k of this.extractKeywords(s)) {
        recentKeywords.add(k);
      }
    }

    const newKeywords = this.extractKeywords(newSentence);
    const overlap = this.calculateKeywordOverlap(recentKeywords, newKeywords);

    // Low overlap with recent content suggests topic shift
    return overlap < 0.1 && newKeywords.size > 3;
  }

  /**
   * Get sentences for overlap
   */
  private getOverlapSentences(
    sentences: string[],
    targetOverlapChars: number
  ): string[] {
    const result: string[] = [];
    let totalChars = 0;

    for (let i = sentences.length - 1; i >= 0 && totalChars < targetOverlapChars; i--) {
      const sentence = sentences[i];
      if (!sentence) continue;
      result.unshift(sentence);
      totalChars += sentence.length + 1;
    }

    return result;
  }

  /**
   * Calculate semantic coherence score for a chunk
   */
  private calculateSemanticCoherence(sentences: string[]): number {
    if (sentences.length < 2) return 1;

    let totalOverlap = 0;
    let comparisons = 0;

    for (let i = 1; i < sentences.length; i++) {
      const prev = sentences[i - 1];
      const curr = sentences[i];
      if (!prev || !curr) continue;

      const prevKeywords = this.extractKeywords(prev);
      const currKeywords = this.extractKeywords(curr);
      totalOverlap += this.calculateKeywordOverlap(prevKeywords, currKeywords);
      comparisons++;
    }

    return comparisons > 0 ? totalOverlap / comparisons : 1;
  }

  /**
   * Get top N keywords from a set
   */
  private getTopKeywords(keywords: Set<string>, n: number): string[] {
    // In a real implementation, this would rank by frequency/importance
    // For now, just return first N
    return Array.from(keywords).slice(0, n);
  }

  /**
   * Add sibling chunk references to metadata
   */
  private addSiblingReferences(chunks: TextChunk[]): void {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) continue;

      const siblingIds: string[] = [];

      if (i > 0) {
        siblingIds.push(`chunk_${i - 1}`);
      }
      if (i < chunks.length - 1) {
        siblingIds.push(`chunk_${i + 1}`);
      }

      if (!chunk.metadata) {
        chunk.metadata = {};
      }
      chunk.metadata.siblingChunkIds = siblingIds;
    }
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Use a more robust sentence splitting
    const sentences: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      const match = remaining.match(/[.!?]+[\s]+(?=[A-Z])/);
      if (match && match.index !== undefined) {
        const sentence = remaining.slice(0, match.index + match[0].length).trim();
        sentences.push(sentence);
        remaining = remaining.slice(match.index + match[0].length);
      } else {
        // Last sentence
        if (remaining.trim()) {
          sentences.push(remaining.trim());
        }
        break;
      }
    }

    return sentences;
  }

  /**
   * Find the last sentence boundary within a range
   */
  private findLastSentenceBoundary(text: string, targetPosition: number): number {
    // Find all sentence endings
    const endings: number[] = [];
    let match;
    const regex = /[.!?]+[\s]+/g;

    while ((match = regex.exec(text)) !== null) {
      endings.push(match.index + match[0].length);
    }

    // Find the ending closest to target position
    let bestMatch = -1;
    for (const ending of endings) {
      if (ending <= targetPosition + 50) {
        bestMatch = ending;
      } else {
        break;
      }
    }

    return bestMatch;
  }

  /**
   * Find where to start overlap
   */
  private findOverlapStart(text: string): number {
    const targetOverlap = this.options.chunkOverlap;
    const start = Math.max(0, text.length - targetOverlap - 100);
    const searchText = text.slice(start);

    // Try to start at a sentence boundary
    const match = searchText.match(/[.!?]+[\s]+/);
    if (match && match.index !== undefined) {
      const overlapStart = start + match.index + match[0].length;
      if (text.length - overlapStart <= targetOverlap + 100) {
        return overlapStart;
      }
    }

    // Fall back to target position
    return Math.max(0, text.length - targetOverlap);
  }

  /**
   * Estimate token count (rough approximation)
   * Using ~4 characters per token as average
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Normalize text for chunking
   */
  private normalizeText(text: string): string {
    // Normalize whitespace
    let normalized = text.replace(/\r\n?/g, "\n");

    // Remove excessive whitespace
    normalized = normalized.replace(/[ \t]+/g, " ");

    // Normalize newlines
    normalized = normalized.replace(/\n{3,}/g, "\n\n");

    return normalized.trim();
  }
}

// Export singleton instance
export const chunkingService = new ChunkingService();

// Export utility function
export function chunkText(
  text: string,
  options?: Partial<ChunkingOptions>
): TextChunk[] {
  const service = new ChunkingService(options);
  return service.chunk(text);
}

// Export preset configurations
export const CHUNKING_PRESETS = {
  default: DEFAULT_OPTIONS,

  small: {
    ...DEFAULT_OPTIONS,
    chunkSize: 500,
    chunkOverlap: 100,
    minChunkSize: 50,
    maxChunkSize: 1000,
  },

  large: {
    ...DEFAULT_OPTIONS,
    chunkSize: 2000,
    chunkOverlap: 400,
    minChunkSize: 200,
    maxChunkSize: 4000,
  },

  qa: {
    ...DEFAULT_OPTIONS,
    strategy: "paragraph" as ChunkingStrategy,
    chunkSize: 800,
    chunkOverlap: 150,
    minChunkSize: 100,
    maxChunkSize: 1500,
    preserveSentences: true,
    preserveParagraphs: true,
  },

  summary: {
    ...DEFAULT_OPTIONS,
    strategy: "semantic" as ChunkingStrategy,
    chunkSize: 1500,
    chunkOverlap: 300,
    minChunkSize: 200,
    maxChunkSize: 3000,
  },

  semantic_nlp: {
    ...DEFAULT_OPTIONS,
    strategy: "semantic_nlp" as ChunkingStrategy,
    chunkSize: 1000,
    chunkOverlap: 200,
    minChunkSize: 150,
    maxChunkSize: 2000,
    semanticThreshold: 0.4,
    includeParentContext: true,
    preserveSentences: true,
  },
} as const;

/**
 * Chunking Service
 *
 * Splits documents into smaller chunks for embedding and retrieval.
 * Supports multiple chunking strategies:
 * - Fixed size with overlap
 * - Sentence-based
 * - Paragraph-based
 * - Semantic (heading-based)
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
}

export type ChunkingStrategy =
  | "fixed"
  | "sentence"
  | "paragraph"
  | "semantic";

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
} as const;

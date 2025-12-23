/**
 * Base Content Extractor
 *
 * Abstract base class for all content extractors.
 * Provides common interface and utilities for extracting text from various file formats.
 */

// Types
export interface ExtractionResult {
  content: string;
  metadata: ExtractionMetadata;
  sections?: ContentSection[];
}

export interface ExtractionMetadata {
  title?: string;
  author?: string;
  pageCount?: number;
  wordCount: number;
  charCount: number;
  mimeType: string;
  extractedAt: Date;
  language?: string;
  customMetadata?: Record<string, unknown>;
}

export interface ContentSection {
  title?: string;
  content: string;
  level?: number; // Heading level (1-6)
  pageNumber?: number;
  index: number;
}

export interface ExtractorOptions {
  maxContentLength?: number;
  preserveFormatting?: boolean;
  extractSections?: boolean;
  encoding?: string;
}

export const DEFAULT_EXTRACTOR_OPTIONS: ExtractorOptions = {
  maxContentLength: 10_000_000, // 10MB text limit
  preserveFormatting: false,
  extractSections: true,
  encoding: "utf-8",
};

/**
 * Abstract Base Extractor Class
 */
export abstract class BaseExtractor {
  protected options: ExtractorOptions;

  constructor(options: Partial<ExtractorOptions> = {}) {
    this.options = { ...DEFAULT_EXTRACTOR_OPTIONS, ...options };
  }

  /**
   * Extract content from the given input
   */
  abstract extract(input: Buffer | string): Promise<ExtractionResult>;

  /**
   * Get supported MIME types
   */
  abstract getSupportedMimeTypes(): string[];

  /**
   * Get supported file extensions
   */
  abstract getSupportedExtensions(): string[];

  /**
   * Check if this extractor can handle the given MIME type
   */
  canHandle(mimeType: string): boolean {
    return this.getSupportedMimeTypes().some((supported) =>
      mimeType.toLowerCase().includes(supported.toLowerCase())
    );
  }

  /**
   * Check if this extractor can handle the given file extension
   */
  canHandleExtension(extension: string): boolean {
    const ext = extension.toLowerCase().replace(/^\./, "");
    return this.getSupportedExtensions().includes(ext);
  }

  /**
   * Clean and normalize extracted text
   */
  protected cleanText(text: string): string {
    // Normalize whitespace
    let cleaned = text.replace(/\s+/g, " ");

    // Remove control characters
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

    // Normalize line breaks
    cleaned = cleaned.replace(/\r\n?/g, "\n");

    // Remove excessive newlines
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

    // Trim
    cleaned = cleaned.trim();

    // Apply max length if set
    if (
      this.options.maxContentLength &&
      cleaned.length > this.options.maxContentLength
    ) {
      cleaned = cleaned.slice(0, this.options.maxContentLength);
    }

    return cleaned;
  }

  /**
   * Count words in text
   */
  protected countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  }

  /**
   * Estimate language from text (basic heuristic)
   */
  protected detectLanguage(text: string): string | undefined {
    // Very basic detection - can be enhanced with a proper library
    const sample = text.slice(0, 1000).toLowerCase();

    // Check for common language patterns
    if (/[\u4e00-\u9fff]/.test(sample)) return "zh"; // Chinese
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(sample)) return "ja"; // Japanese
    if (/[\uac00-\ud7af]/.test(sample)) return "ko"; // Korean
    if (/[\u0600-\u06ff]/.test(sample)) return "ar"; // Arabic
    if (/[\u0400-\u04ff]/.test(sample)) return "ru"; // Russian/Cyrillic

    // Default to English for Latin scripts
    if (/[a-z]/.test(sample)) return "en";

    return undefined;
  }

  /**
   * Create metadata object
   */
  protected createMetadata(
    content: string,
    mimeType: string,
    extra: Partial<ExtractionMetadata> = {}
  ): ExtractionMetadata {
    return {
      wordCount: this.countWords(content),
      charCount: content.length,
      mimeType,
      extractedAt: new Date(),
      language: this.detectLanguage(content),
      ...extra,
    };
  }
}

/**
 * Extractor Error
 */
export class ExtractionError extends Error {
  constructor(
    message: string,
    public extractor: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

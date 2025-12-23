/**
 * PDF Content Extractor
 *
 * Extracts text content from PDF documents using pdf-parse.
 * Handles page-level extraction and metadata.
 */

import {
  BaseExtractor,
  ExtractionResult,
  ContentSection,
  ExtractorOptions,
  ExtractionError,
} from "./base-extractor";

/**
 * PDF Extractor Class
 */
export class PDFExtractor extends BaseExtractor {
  constructor(options: Partial<ExtractorOptions> = {}) {
    super(options);
  }

  getSupportedMimeTypes(): string[] {
    return ["application/pdf"];
  }

  getSupportedExtensions(): string[] {
    return ["pdf"];
  }

  async extract(input: Buffer | string): Promise<ExtractionResult> {
    if (typeof input === "string") {
      throw new ExtractionError(
        "PDF extractor requires a Buffer input",
        "PDFExtractor"
      );
    }

    try {
      // Dynamic import to avoid issues in edge runtime
      const pdfParseModule = (await import("pdf-parse")) as {
        default?: (buffer: Buffer) => Promise<PDFParseResult>;
      };
      const pdfParse = pdfParseModule.default ?? pdfParseModule;

      if (typeof pdfParse !== "function") {
        throw new ExtractionError(
          "pdf-parse module not properly loaded",
          "PDFExtractor"
        );
      }

      const data = await pdfParse(input);

      const content = this.cleanText(data.text);
      const sections = this.extractSections(data, content);

      return {
        content,
        metadata: this.createMetadata(content, "application/pdf", {
          title: data.info?.Title,
          author: data.info?.Author,
          pageCount: data.numpages,
          customMetadata: {
            creator: data.info?.Creator,
            producer: data.info?.Producer,
            creationDate: data.info?.CreationDate,
            modificationDate: data.info?.ModDate,
          },
        }),
        sections: this.options.extractSections ? sections : undefined,
      };
    } catch (error) {
      if (error instanceof ExtractionError) throw error;

      throw new ExtractionError(
        `Failed to extract PDF content: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "PDFExtractor",
        error
      );
    }
  }

  /**
   * Extract sections from PDF (page-based)
   */
  private extractSections(
    data: PDFParseResult,
    fullContent: string
  ): ContentSection[] {
    const sections: ContentSection[] = [];

    // If we have page-level text, create sections per page
    // Note: pdf-parse doesn't provide page-by-page text directly,
    // so we'll try to split by page markers or create logical sections

    // Try to detect page breaks (common patterns)
    const pageBreakPatterns = [
      /\f/g, // Form feed
      /\n(?=Page \d+)/gi,
      /\n(?=\d+ of \d+)/gi,
    ];

    let pageSections: string[] = [fullContent];

    for (const pattern of pageBreakPatterns) {
      const parts = fullContent.split(pattern);
      if (parts.length > 1 && parts.length <= data.numpages) {
        pageSections = parts;
        break;
      }
    }

    // If no page breaks detected, split evenly based on page count
    if (pageSections.length === 1 && data.numpages > 1) {
      const avgPageLength = Math.ceil(fullContent.length / data.numpages);
      pageSections = [];

      for (let i = 0; i < data.numpages; i++) {
        const start = i * avgPageLength;
        const end = Math.min(start + avgPageLength, fullContent.length);
        const pageContent = fullContent.slice(start, end).trim();

        if (pageContent) {
          // Try to break at sentence/paragraph boundary
          const adjustedEnd = this.findNaturalBreak(
            fullContent,
            start,
            end,
            avgPageLength
          );
          pageSections.push(fullContent.slice(start, adjustedEnd).trim());
        }
      }
    }

    // Create sections from pages
    for (let i = 0; i < pageSections.length; i++) {
      const pageContent = pageSections[i];
      if (!pageContent || !pageContent.trim()) continue;

      sections.push({
        title: `Page ${i + 1}`,
        content: pageContent.trim(),
        pageNumber: i + 1,
        index: i,
      });
    }

    return sections;
  }

  /**
   * Find a natural break point near the target position
   */
  private findNaturalBreak(
    text: string,
    start: number,
    target: number,
    maxDelta: number
  ): number {
    // Look for paragraph break
    const searchStart = Math.max(target - 200, start);
    const searchEnd = Math.min(target + 200, text.length);
    const searchText = text.slice(searchStart, searchEnd);

    // Try paragraph break first
    const paragraphMatch = searchText.lastIndexOf("\n\n");
    if (paragraphMatch !== -1) {
      const pos = searchStart + paragraphMatch + 2;
      if (Math.abs(pos - target) < maxDelta * 0.2) {
        return pos;
      }
    }

    // Try sentence break
    const sentencePattern = /[.!?]\s+/g;
    let lastMatch = -1;
    let match;

    while ((match = sentencePattern.exec(searchText)) !== null) {
      const pos = searchStart + match.index + match[0].length;
      if (pos <= target + 50) {
        lastMatch = pos;
      }
    }

    if (lastMatch !== -1) {
      return lastMatch;
    }

    return target;
  }
}

// PDF-parse result type
interface PDFParseResult {
  text: string;
  numpages: number;
  info?: {
    Title?: string;
    Author?: string;
    Creator?: string;
    Producer?: string;
    CreationDate?: string;
    ModDate?: string;
  };
}

// Export singleton instance
export const pdfExtractor = new PDFExtractor();

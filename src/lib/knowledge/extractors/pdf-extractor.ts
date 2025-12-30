/**
 * PDF Content Extractor
 *
 * Extracts text content from PDF documents using pdf-parse v2.
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
 * Uses pdf-parse v2 class-based API
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
    console.log("[PDFExtractor] Starting PDF extraction...");
    console.log("[PDFExtractor] Input type:", typeof input);
    console.log("[PDFExtractor] Input is Buffer:", Buffer.isBuffer(input));

    if (typeof input === "string") {
      throw new ExtractionError(
        "PDF extractor requires a Buffer input",
        "PDFExtractor"
      );
    }

    console.log("[PDFExtractor] Buffer length:", input.length);

    try {
      // Dynamic import to avoid issues in edge runtime
      // pdf-parse v2 exports PDFParse class
      console.log("[PDFExtractor] Importing pdf-parse module...");
      const pdfParseModule = await import("pdf-parse");
      console.log("[PDFExtractor] Module imported, type:", typeof pdfParseModule);
      console.log("[PDFExtractor] Module keys:", Object.keys(pdfParseModule));

      // Get PDFParse class - handle both ESM and CJS contexts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = pdfParseModule as any;
      console.log("[PDFExtractor] Checking for PDFParse class...");
      console.log("[PDFExtractor] mod.PDFParse type:", typeof mod.PDFParse);
      console.log("[PDFExtractor] mod.default type:", typeof mod.default);
      console.log("[PDFExtractor] mod.default?.PDFParse type:", typeof mod.default?.PDFParse);

      const PDFParseClass = mod.PDFParse || mod.default?.PDFParse;
      console.log("[PDFExtractor] PDFParseClass type:", typeof PDFParseClass);

      if (!PDFParseClass) {
        const availableKeys = Object.keys(pdfParseModule).join(", ");
        console.error("[PDFExtractor] PDFParse class not found! Available exports:", availableKeys);
        throw new ExtractionError(
          `pdf-parse PDFParse class not found. Available exports: ${availableKeys}`,
          "PDFExtractor"
        );
      }

      // Create parser instance with buffer
      // Convert Node.js Buffer to Uint8Array for compatibility
      console.log("[PDFExtractor] Converting buffer to Uint8Array...");
      const uint8Array = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
      console.log("[PDFExtractor] Uint8Array length:", uint8Array.length);

      console.log("[PDFExtractor] Creating PDFParse instance...");
      const parser = new PDFParseClass({ data: uint8Array });
      console.log("[PDFExtractor] Parser created successfully");

      // Extract text and info
      console.log("[PDFExtractor] Calling parser.getText()...");
      const textResult = await parser.getText();
      console.log("[PDFExtractor] getText result:", {
        hasText: !!textResult?.text,
        textLength: textResult?.text?.length || 0,
        hasPages: !!textResult?.pages,
        pagesCount: textResult?.pages?.length || 0,
      });

      let info: PDFInfo | undefined;
      try {
        console.log("[PDFExtractor] Calling parser.getInfo()...");
        info = await parser.getInfo();
        console.log("[PDFExtractor] getInfo result:", info);
      } catch (infoError) {
        console.log("[PDFExtractor] getInfo failed (non-fatal):", infoError);
        // getInfo may fail on some PDFs, continue without metadata
      }

      const content = this.cleanText(textResult.text || "");
      const pageCount = textResult.pages?.length || info?.numPages || 1;
      console.log("[PDFExtractor] Cleaned content length:", content.length);
      console.log("[PDFExtractor] Page count:", pageCount);

      // Extract sections from pages if available
      const sections = this.extractSections(textResult, pageCount, content);
      console.log("[PDFExtractor] Sections extracted:", sections.length);

      // Clean up parser
      try {
        console.log("[PDFExtractor] Destroying parser...");
        await parser.destroy();
        console.log("[PDFExtractor] Parser destroyed");
      } catch {
        // Ignore cleanup errors
      }

      console.log("[PDFExtractor] PDF extraction complete!");
      return {
        content,
        metadata: this.createMetadata(content, "application/pdf", {
          title: info?.info?.Title,
          author: info?.info?.Author,
          pageCount,
          customMetadata: {
            creator: info?.info?.Creator,
            producer: info?.info?.Producer,
            creationDate: info?.info?.CreationDate,
            modificationDate: info?.info?.ModDate,
          },
        }),
        sections: this.options.extractSections ? sections : undefined,
      };
    } catch (error) {
      console.error("[PDFExtractor] Error during extraction:", error);
      if (error instanceof ExtractionError) throw error;

      throw new ExtractionError(
        `Failed to process PDF: ${
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
    textResult: PDFTextResult,
    pageCount: number,
    fullContent: string
  ): ContentSection[] {
    const sections: ContentSection[] = [];

    // If we have page-level text from the parser, use it
    if (textResult.pages && textResult.pages.length > 0) {
      for (let i = 0; i < textResult.pages.length; i++) {
        const pageText = textResult.pages[i];
        if (pageText && pageText.trim()) {
          sections.push({
            title: `Page ${i + 1}`,
            content: this.cleanText(pageText),
            pageNumber: i + 1,
            index: i,
          });
        }
      }
      return sections;
    }

    // Fallback: Try to detect page breaks in the full content
    const pageBreakPatterns = [
      /\f/g, // Form feed
      /\n(?=Page \d+)/gi,
      /\n(?=\d+ of \d+)/gi,
    ];

    let pageSections: string[] = [fullContent];

    for (const pattern of pageBreakPatterns) {
      const parts = fullContent.split(pattern);
      if (parts.length > 1 && parts.length <= pageCount) {
        pageSections = parts;
        break;
      }
    }

    // If no page breaks detected and we have multiple pages, split evenly
    if (pageSections.length === 1 && pageCount > 1) {
      const avgPageLength = Math.ceil(fullContent.length / pageCount);
      pageSections = [];

      for (let i = 0; i < pageCount; i++) {
        const start = i * avgPageLength;
        const end = Math.min(start + avgPageLength, fullContent.length);
        const pageContent = fullContent.slice(start, end).trim();

        if (pageContent) {
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

// PDF-parse v2 result types
interface PDFTextResult {
  text: string;
  pages?: string[];
}

interface PDFInfo {
  numPages?: number;
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

/**
 * Document Processor
 *
 * Extracts text content from various file formats:
 * - PDF documents
 * - DOCX (Word documents)
 * - HTML pages
 * - Plain text files
 * - Markdown files
 */

import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

// Types
export interface ProcessedDocument {
  content: string;
  metadata: DocumentMetadata;
}

export interface DocumentMetadata {
  title?: string;
  author?: string;
  pageCount?: number;
  wordCount: number;
  charCount: number;
  fileType: string;
  processedAt: Date;
  sections?: DocumentSection[];
}

export interface DocumentSection {
  title?: string;
  content: string;
  pageNumber?: number;
  index: number;
}

export interface ProcessorOptions {
  preserveFormatting?: boolean;
  extractMetadata?: boolean;
  maxContentLength?: number;
}

const DEFAULT_OPTIONS: ProcessorOptions = {
  preserveFormatting: false,
  extractMetadata: true,
  maxContentLength: 10_000_000, // 10MB text limit
};

/**
 * Main document processor class
 */
export class DocumentProcessor {
  private options: ProcessorOptions;

  constructor(options: ProcessorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Process a document based on its file type
   */
  async process(
    content: Buffer | string,
    fileType: string,
    fileName?: string
  ): Promise<ProcessedDocument> {
    const normalizedType = this.normalizeFileType(fileType, fileName);

    switch (normalizedType) {
      case "pdf":
        return this.processPdf(content as Buffer);
      case "docx":
        return this.processDocx(content as Buffer);
      case "html":
        return this.processHtml(
          typeof content === "string" ? content : content.toString("utf-8")
        );
      case "markdown":
        return this.processMarkdown(
          typeof content === "string" ? content : content.toString("utf-8")
        );
      case "text":
      default:
        return this.processText(
          typeof content === "string" ? content : content.toString("utf-8")
        );
    }
  }

  /**
   * Normalize file type from MIME type or extension
   */
  private normalizeFileType(fileType: string, fileName?: string): string {
    const type = fileType.toLowerCase();
    const extension = fileName?.split(".").pop()?.toLowerCase();

    // Check MIME types
    if (type.includes("pdf") || extension === "pdf") return "pdf";
    if (
      type.includes("wordprocessingml") ||
      type.includes("msword") ||
      extension === "docx" ||
      extension === "doc"
    )
      return "docx";
    if (type.includes("html") || extension === "html" || extension === "htm")
      return "html";
    if (type.includes("markdown") || extension === "md" || extension === "mdx")
      return "markdown";
    if (
      type.includes("text") ||
      extension === "txt" ||
      extension === "text"
    )
      return "text";

    // Default to text
    return "text";
  }

  /**
   * Process PDF documents
   * Uses unpdf which works in serverless/edge environments without web workers
   */
  private async processPdf(buffer: Buffer): Promise<ProcessedDocument> {
    try {
      console.log("[DocumentProcessor] Starting PDF processing with unpdf...");
      console.log("[DocumentProcessor] Buffer length:", buffer.length);

      // Dynamic import unpdf - designed for serverless environments
      const { extractText, getDocumentProxy } = await import("unpdf");

      // Convert Buffer to Uint8Array
      const uint8Array = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      console.log("[DocumentProcessor] Uint8Array length:", uint8Array.length);

      // Extract text from PDF
      console.log("[DocumentProcessor] Extracting text...");
      const { text, totalPages } = await extractText(uint8Array, { mergePages: true });
      console.log("[DocumentProcessor] Extraction complete:", {
        textLength: text?.length || 0,
        totalPages,
      });

      // Try to get metadata
      let title: string | undefined;
      let author: string | undefined;
      try {
        console.log("[DocumentProcessor] Getting document metadata...");
        const pdf = await getDocumentProxy(uint8Array);
        const metadata = await pdf.getMetadata();
        const info = metadata?.info as Record<string, unknown> | undefined;
        title = info?.Title as string | undefined;
        author = info?.Author as string | undefined;
        console.log("[DocumentProcessor] Metadata:", { title, author });
      } catch (metaError) {
        console.log("[DocumentProcessor] Metadata extraction failed (non-fatal):", metaError);
      }

      const content = this.cleanText(text || "");
      console.log("[DocumentProcessor] Cleaned content length:", content.length);

      console.log("[DocumentProcessor] PDF processing complete!");
      return {
        content,
        metadata: {
          title,
          author,
          pageCount: totalPages,
          wordCount: this.countWords(content),
          charCount: content.length,
          fileType: "pdf",
          processedAt: new Date(),
        },
      };
    } catch (error) {
      console.error("[DocumentProcessor] PDF processing error:", error);
      throw new DocumentProcessingError(
        `Failed to process PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
        "pdf"
      );
    }
  }

  /**
   * Process DOCX documents
   */
  private async processDocx(buffer: Buffer): Promise<ProcessedDocument> {
    try {
      // Dynamic import
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });

      const content = this.cleanText(result.value);

      return {
        content,
        metadata: {
          wordCount: this.countWords(content),
          charCount: content.length,
          fileType: "docx",
          processedAt: new Date(),
        },
      };
    } catch (error) {
      throw new DocumentProcessingError(
        `Failed to process DOCX: ${error instanceof Error ? error.message : "Unknown error"}`,
        "docx"
      );
    }
  }

  /**
   * Process HTML content
   */
  private async processHtml(html: string): Promise<ProcessedDocument> {
    try {
      const $ = cheerio.load(html);

      // Remove script and style elements
      $("script, style, noscript, iframe, nav, footer, header").remove();

      // Extract title
      const title = $("title").text() || $("h1").first().text() || undefined;

      // Get text content
      const content = this.cleanText($("body").text() || $.text());

      // Extract sections from headings
      const sections: DocumentSection[] = [];
      let sectionIndex = 0;

      $("h1, h2, h3, h4, h5, h6").each((_, el) => {
        const $heading = $(el);
        const sectionContent = this.extractSectionContent($, $heading);
        if (sectionContent.trim()) {
          sections.push({
            title: $heading.text().trim(),
            content: sectionContent,
            index: sectionIndex++,
          });
        }
      });

      return {
        content,
        metadata: {
          title,
          wordCount: this.countWords(content),
          charCount: content.length,
          fileType: "html",
          processedAt: new Date(),
          sections: sections.length > 0 ? sections : undefined,
        },
      };
    } catch (error) {
      throw new DocumentProcessingError(
        `Failed to process HTML: ${error instanceof Error ? error.message : "Unknown error"}`,
        "html"
      );
    }
  }

  /**
   * Extract content between current heading and next heading
   */
  private extractSectionContent(
    $: cheerio.CheerioAPI,
    $heading: cheerio.Cheerio<AnyNode>
  ): string {
    const texts: string[] = [];
    let $current = $heading.next();

    while ($current.length > 0) {
      const tagName = $current.prop("tagName")?.toLowerCase();
      if (tagName && /^h[1-6]$/.test(tagName)) {
        break;
      }
      texts.push($current.text().trim());
      $current = $current.next();
    }

    return this.cleanText(texts.join(" "));
  }

  /**
   * Process Markdown content
   */
  private async processMarkdown(markdown: string): Promise<ProcessedDocument> {
    // Remove code blocks
    let content = markdown.replace(/```[\s\S]*?```/g, "");
    content = content.replace(/`[^`]+`/g, "");

    // Remove images
    content = content.replace(/!\[.*?\]\(.*?\)/g, "");

    // Remove links but keep text
    content = content.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    // Remove headers markers but keep text
    content = content.replace(/^#{1,6}\s+/gm, "");

    // Remove emphasis markers
    content = content.replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1");

    // Remove horizontal rules
    content = content.replace(/^[-*_]{3,}$/gm, "");

    // Remove list markers
    content = content.replace(/^[\s]*[-*+]\s+/gm, "");
    content = content.replace(/^[\s]*\d+\.\s+/gm, "");

    // Clean the result
    content = this.cleanText(content);

    // Extract title from first heading
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const title = titleMatch && titleMatch[1] ? titleMatch[1].trim() : undefined;

    // Extract sections
    const sections: DocumentSection[] = [];
    const sectionRegex = /^(#{1,6})\s+(.+)$/gm;
    let sectionIndex = 0;
    let match;

    const matches: Array<{ level: number; title: string; index: number }> = [];
    while ((match = sectionRegex.exec(markdown)) !== null) {
      const level = match[1];
      const matchTitle = match[2];
      if (level && matchTitle) {
        matches.push({
          level: level.length,
          title: matchTitle,
          index: match.index,
        });
      }
    }

    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      if (!current) continue;

      const next = matches[i + 1];
      const sectionEnd = next ? next.index : markdown.length;
      const sectionContent = markdown.slice(current.index, sectionEnd);

      // Process section content same as full document
      let cleanContent = sectionContent.replace(/^#{1,6}\s+.+$/m, "");
      cleanContent = this.cleanText(cleanContent);

      if (cleanContent.trim()) {
        sections.push({
          title: current.title,
          content: cleanContent,
          index: sectionIndex++,
        });
      }
    }

    return {
      content,
      metadata: {
        title,
        wordCount: this.countWords(content),
        charCount: content.length,
        fileType: "markdown",
        processedAt: new Date(),
        sections: sections.length > 0 ? sections : undefined,
      },
    };
  }

  /**
   * Process plain text
   */
  private async processText(text: string): Promise<ProcessedDocument> {
    const content = this.cleanText(text);

    return {
      content,
      metadata: {
        wordCount: this.countWords(content),
        charCount: content.length,
        fileType: "text",
        processedAt: new Date(),
      },
    };
  }

  /**
   * Clean and normalize text content
   */
  private cleanText(text: string): string {
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
  private countWords(text: string): number {
    return text
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }
}

/**
 * Custom error for document processing failures
 */
export class DocumentProcessingError extends Error {
  constructor(
    message: string,
    public fileType: string
  ) {
    super(message);
    this.name = "DocumentProcessingError";
  }
}

// Export singleton instance for convenience
export const documentProcessor = new DocumentProcessor();

// Export utility function
export async function processDocument(
  content: Buffer | string,
  fileType: string,
  fileName?: string,
  options?: ProcessorOptions
): Promise<ProcessedDocument> {
  const processor = new DocumentProcessor(options);
  return processor.process(content, fileType, fileName);
}

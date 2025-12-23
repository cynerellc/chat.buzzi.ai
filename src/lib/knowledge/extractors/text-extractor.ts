/**
 * Text Content Extractor
 *
 * Extracts text content from plain text files.
 * Handles various text-based formats including TXT and CSV.
 */

import {
  BaseExtractor,
  ExtractionResult,
  ContentSection,
  ExtractorOptions,
  ExtractionError,
} from "./base-extractor";

/**
 * Text Extractor Class
 */
export class TextExtractor extends BaseExtractor {
  constructor(options: Partial<ExtractorOptions> = {}) {
    super(options);
  }

  getSupportedMimeTypes(): string[] {
    return [
      "text/plain",
      "text/csv",
      "text/tab-separated-values",
      "application/json",
      "text/xml",
      "application/xml",
    ];
  }

  getSupportedExtensions(): string[] {
    return ["txt", "text", "csv", "tsv", "json", "xml", "log"];
  }

  async extract(input: Buffer | string): Promise<ExtractionResult> {
    try {
      const rawContent =
        typeof input === "string"
          ? input
          : input.toString(this.options.encoding as BufferEncoding ?? "utf-8");

      const content = this.cleanText(rawContent);

      // Detect content type
      const contentType = this.detectContentType(rawContent);

      // Extract sections based on content type
      const sections = this.options.extractSections
        ? this.extractSections(rawContent, contentType)
        : undefined;

      return {
        content,
        metadata: this.createMetadata(content, "text/plain", {
          customMetadata: {
            detectedFormat: contentType,
            lineCount: rawContent.split("\n").length,
          },
        }),
        sections,
      };
    } catch (error) {
      if (error instanceof ExtractionError) throw error;

      throw new ExtractionError(
        `Failed to extract text content: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "TextExtractor",
        error
      );
    }
  }

  /**
   * Detect the type of text content
   */
  private detectContentType(
    content: string
  ): "plain" | "csv" | "json" | "xml" | "log" {
    const trimmed = content.trim();

    // JSON detection
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        JSON.parse(trimmed);
        return "json";
      } catch {
        // Not valid JSON
      }
    }

    // XML detection
    if (trimmed.startsWith("<?xml") || trimmed.startsWith("<")) {
      if (/<[^>]+>[\s\S]*<\/[^>]+>/.test(trimmed)) {
        return "xml";
      }
    }

    // CSV detection (consistent comma/tab separation)
    const lines = trimmed.split("\n").slice(0, 10);
    const commaCount = lines[0]?.split(",").length ?? 0;
    const tabCount = lines[0]?.split("\t").length ?? 0;

    if (commaCount > 1) {
      const isConsistent = lines.every(
        (line) => Math.abs(line.split(",").length - commaCount) <= 1
      );
      if (isConsistent) return "csv";
    }

    if (tabCount > 1) {
      const isConsistent = lines.every(
        (line) => Math.abs(line.split("\t").length - tabCount) <= 1
      );
      if (isConsistent) return "csv"; // TSV is a type of CSV
    }

    // Log file detection
    if (/^\[?\d{4}[-/]\d{2}[-/]\d{2}/.test(trimmed)) {
      return "log";
    }

    return "plain";
  }

  /**
   * Extract sections based on content type
   */
  private extractSections(
    content: string,
    contentType: "plain" | "csv" | "json" | "xml" | "log"
  ): ContentSection[] {
    switch (contentType) {
      case "json":
        return this.extractJsonSections(content);
      case "xml":
        return this.extractXmlSections(content);
      case "csv":
        return this.extractCsvSections(content);
      case "log":
        return this.extractLogSections(content);
      default:
        return this.extractPlainTextSections(content);
    }
  }

  /**
   * Extract sections from plain text (paragraph-based)
   */
  private extractPlainTextSections(content: string): ContentSection[] {
    const sections: ContentSection[] = [];
    const paragraphs = content.split(/\n\n+/).filter((p) => p.trim());

    // Try to detect headers (lines followed by content)
    let currentSection: { title?: string; content: string[] } | null = null;
    let sectionIndex = 0;

    for (const paragraph of paragraphs) {
      const lines = paragraph.trim().split("\n");
      const firstLine = lines[0]?.trim() ?? "";

      // Check if this looks like a header
      const isHeader =
        firstLine.length < 100 &&
        (firstLine.endsWith(":") ||
          firstLine === firstLine.toUpperCase() ||
          /^[A-Z][^.!?]*$/.test(firstLine));

      if (isHeader && lines.length === 1) {
        // Save previous section
        if (currentSection && currentSection.content.length > 0) {
          sections.push({
            title: currentSection.title,
            content: currentSection.content.join("\n\n"),
            index: sectionIndex++,
          });
        }

        // Start new section with header
        currentSection = {
          title: firstLine.replace(/:$/, ""),
          content: [],
        };
      } else if (currentSection) {
        currentSection.content.push(paragraph.trim());
      } else {
        // No header yet, create intro section
        currentSection = {
          content: [paragraph.trim()],
        };
      }
    }

    // Save last section
    if (currentSection && currentSection.content.length > 0) {
      sections.push({
        title: currentSection.title,
        content: currentSection.content.join("\n\n"),
        index: sectionIndex,
      });
    }

    return sections;
  }

  /**
   * Extract sections from JSON content
   */
  private extractJsonSections(content: string): ContentSection[] {
    try {
      const data = JSON.parse(content);
      const sections: ContentSection[] = [];

      if (Array.isArray(data)) {
        // Array - each item is a section
        data.forEach((item, index) => {
          sections.push({
            title: `Item ${index + 1}`,
            content: JSON.stringify(item, null, 2),
            index,
          });
        });
      } else if (typeof data === "object" && data !== null) {
        // Object - each key is a section
        Object.entries(data).forEach(([key, value], index) => {
          sections.push({
            title: key,
            content:
              typeof value === "object"
                ? JSON.stringify(value, null, 2)
                : String(value),
            index,
          });
        });
      }

      return sections;
    } catch {
      return this.extractPlainTextSections(content);
    }
  }

  /**
   * Extract sections from XML content
   */
  private extractXmlSections(content: string): ContentSection[] {
    const sections: ContentSection[] = [];
    const rootTagMatch = content.match(/<([^>\s/]+)/);

    if (!rootTagMatch) {
      return this.extractPlainTextSections(content);
    }

    // Find top-level child elements
    const elementPattern = /<([a-zA-Z][a-zA-Z0-9]*)[^>]*>[\s\S]*?<\/\1>/g;
    let match;
    let index = 0;

    while ((match = elementPattern.exec(content)) !== null) {
      const tagName = match[1];
      const elementContent = match[0];

      // Only include substantial elements
      if (elementContent.length > 50) {
        sections.push({
          title: tagName,
          content: elementContent,
          index: index++,
        });
      }
    }

    return sections.length > 0 ? sections : this.extractPlainTextSections(content);
  }

  /**
   * Extract sections from CSV content
   */
  private extractCsvSections(content: string): ContentSection[] {
    const lines = content.split("\n");
    const sections: ContentSection[] = [];

    if (lines.length === 0) return sections;

    // First line might be headers
    const headerLine = lines[0]?.trim() ?? "";
    const delimiter = headerLine.includes("\t") ? "\t" : ",";
    const headers = headerLine.split(delimiter).map((h) => h.trim());

    // Create a summary section
    sections.push({
      title: "CSV Data Summary",
      content: `Headers: ${headers.join(", ")}\nTotal rows: ${lines.length - 1}`,
      index: 0,
    });

    // If small enough, include all data
    if (lines.length <= 100) {
      sections.push({
        title: "Data Content",
        content: content,
        index: 1,
      });
    } else {
      // Just include sample
      sections.push({
        title: "Data Sample (first 50 rows)",
        content: lines.slice(0, 51).join("\n"),
        index: 1,
      });
    }

    return sections;
  }

  /**
   * Extract sections from log content
   */
  private extractLogSections(content: string): ContentSection[] {
    const lines = content.split("\n");
    const sections: ContentSection[] = [];

    // Group by date or log level
    let currentGroup: { date?: string; content: string[] } | null = null;
    let sectionIndex = 0;

    const datePattern = /^[\[\(]?(\d{4}[-/]\d{2}[-/]\d{2})/;

    for (const line of lines) {
      const dateMatch = line.match(datePattern);

      if (dateMatch) {
        const date = dateMatch[1];

        if (!currentGroup || currentGroup.date !== date) {
          // Save previous group
          if (currentGroup && currentGroup.content.length > 0) {
            sections.push({
              title: `Log entries: ${currentGroup.date ?? "Unknown date"}`,
              content: currentGroup.content.join("\n"),
              index: sectionIndex++,
            });
          }

          // Start new group
          currentGroup = {
            date,
            content: [line],
          };
        } else {
          currentGroup.content.push(line);
        }
      } else if (currentGroup) {
        // Continuation of current entry
        currentGroup.content.push(line);
      }
    }

    // Save last group
    if (currentGroup && currentGroup.content.length > 0) {
      sections.push({
        title: `Log entries: ${currentGroup.date ?? "Unknown date"}`,
        content: currentGroup.content.join("\n"),
        index: sectionIndex,
      });
    }

    return sections;
  }
}

// Export singleton instance
export const textExtractor = new TextExtractor();
